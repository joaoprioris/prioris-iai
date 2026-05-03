import { Router, type IRouter } from "express";
import { eq, and, ilike } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { db, sessionsTable, momentLibraryTable, sedsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const MAX_EXCHANGES = 10;
const WRAP_UP_AT = 8;
const CLOSE_SIGNAL = "[ENCERRAR]";

const CLOSING_MESSAGE =
  "Com isso, você já tem mais clareza. IAí, posso te apoiar no próximo passo quando precisar.";

// Replit AI Integration proxy with fallback
const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? "";
const anthropic = new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });

const MODEL_HAIKU = "claude-haiku-4-5";
const MODEL_SONNET = "claude-sonnet-4-5";

const AGENT_TYPES = ["MNT", "IMP", "FBK", "OTO", "CTN", "CRS", "PRF"] as const;
type AgentType = (typeof AGENT_TYPES)[number];

const AGENT_LABELS: Record<AgentType, string> = {
  MNT: "decisão estratégica",
  IMP: "impacto humano",
  FBK: "feedback",
  OTO: "conversa ao vivo",
  CTN: "contenção",
  CRS: "crise",
  PRF: "padrões",
};

const DEBT_VALUES = [
  "EVITACAO_CONFLITO", "AUTORIDADE_FRAGILIZADA", "COMUNICACAO_AMBIGUA",
  "ACCOUNTABILITY_DILUIDA", "DECISAO_POSTERGADA", "CONFIANCA_EROSIONADA",
  "APRENDIZADO_BLOQUEADO", "ALINHAMENTO_SIMBOLICO", "ENERGIA_EMOCIONAL", "MATURIDADE_POLITICA",
] as const;

const CONTEXT_TYPE_VALUES = [
  "FEEDBACK", "DECISAO", "CONFLITO", "ALINHAMENTO", "CRISE", "DELEGACAO",
  "POLITICA", "COMUNICACAO", "GESTAO_TIME", "CLIENTE", "PARES", "CHEFE", "CARREIRA", "OUTRO",
] as const;

const ACTOR_VALUES = ["LIDERADO", "PAR", "CHEFE", "CLIENTE", "TIME", "OUTRO"] as const;
const MOMENT_PHASE_VALUES = ["BEFORE", "DURING", "AFTER"] as const;

interface SedRaw {
  debt_primary: string;
  debt_adjacent?: string | null;
  context_type: string;
  actor: string;
  moment_phase: string;
  intensity: number;
  confidence: number;
  self_assessment: string;
  timestamp: string;
}

function validateSed(raw: unknown): SedRaw | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  if (!DEBT_VALUES.includes(r.debt_primary as typeof DEBT_VALUES[number])) return null;
  if (r.debt_adjacent != null && !DEBT_VALUES.includes(r.debt_adjacent as typeof DEBT_VALUES[number])) return null;
  if (!CONTEXT_TYPE_VALUES.includes(r.context_type as typeof CONTEXT_TYPE_VALUES[number])) return null;
  if (!ACTOR_VALUES.includes(r.actor as typeof ACTOR_VALUES[number])) return null;
  if (!MOMENT_PHASE_VALUES.includes(r.moment_phase as typeof MOMENT_PHASE_VALUES[number])) return null;
  if (typeof r.intensity !== "number" || !Number.isInteger(r.intensity) || r.intensity < 1 || r.intensity > 5) return null;
  if (typeof r.confidence !== "number" || r.confidence < 0 || r.confidence > 1) return null;
  if (typeof r.self_assessment !== "string" || !r.self_assessment.trim()) return null;
  if (typeof r.timestamp !== "string") return null;

  return {
    debt_primary: r.debt_primary as string,
    debt_adjacent: (r.debt_adjacent as string | null) ?? null,
    context_type: r.context_type as string,
    actor: r.actor as string,
    moment_phase: r.moment_phase as string,
    intensity: r.intensity as number,
    confidence: r.confidence as number,
    self_assessment: r.self_assessment as string,
    timestamp: r.timestamp as string,
  };
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SessionContext {
  messages: Message[];
  agentType: string | null;
  debtPrimary: string | null;
  debtAdjacent: string | null;
}

function getSystemPrompt(agentType: string, exchangeCount: number): string {
  const key = `PROMPT_${agentType}`;
  let prompt =
    process.env[key] ??
    `Você é o agente de suporte à decisão executiva IAí (${AGENT_LABELS[agentType as AgentType] ?? agentType}). Ajude o líder de forma direta, objetiva e respeitosa. Máximo de ${MAX_EXCHANGES} trocas por sessão.`;

  // Closing sentence is always appended server-side on the final exchange only.
  // The model must NEVER generate it independently.
  prompt +=
    `\n\nREGRA OBRIGATÓRIA: Nunca escreva a frase "${CLOSING_MESSAGE}" — ela será adicionada automaticamente pelo sistema na última troca. Se você a escrever, ela aparecerá duplicada.`;

  // Allow early closing: if the leader already has clarity, end the session now.
  prompt +=
    `\n\nENCERRAMENTO ANTECIPADO: Se você perceber que o líder já alcançou clareza suficiente antes de ${MAX_EXCHANGES} trocas, você pode encerrar a conversa mais cedo. Para isso, termine sua resposta com exatamente "${CLOSE_SIGNAL}" na última linha. O sistema removerá esse marcador e adicionará a mensagem de encerramento automaticamente. Não use "${CLOSE_SIGNAL}" se a conversa ainda precisar continuar.`;

  if (exchangeCount >= WRAP_UP_AT) {
    prompt +=
      "\n\nIMPORTANT: Begin wrapping up. Guide toward conclusion. 2 exchanges left.";
  }

  return prompt;
}

async function classifyWithHaiku(content: string): Promise<{
  agent_type: string;
  debt_primary: string;
  debt_adjacent: string | null;
  confidence: number;
}> {
  const message = await anthropic.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 256,
    system:
      "You are a router. Classify this leader message into one of: MNT (strategic decision), IMP (human impact), FBK (feedback), OTO (live conversation), CTN (containment), CRS (crisis), PRF (patterns). Return ONLY JSON: {agent_type, debt_primary, debt_adjacent, confidence}",
    messages: [{ role: "user", content }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
  try {
    const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim());
    return {
      agent_type: AGENT_TYPES.includes(parsed.agent_type) ? parsed.agent_type : "MNT",
      debt_primary: parsed.debt_primary ?? "decisao-estrategica",
      debt_adjacent: parsed.debt_adjacent ?? null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    };
  } catch {
    return { agent_type: "MNT", debt_primary: "decisao-estrategica", debt_adjacent: null, confidence: 0.3 };
  }
}

async function generateAndSaveSed(
  sessionId: string,
  organizationId: string,
  messages: Message[],
  lowConfidence: boolean,
): Promise<void> {
  const transcript = messages
    .map((m) => `${m.role === "user" ? "Líder" : "IAí"}: ${m.content}`)
    .join("\n\n");

  try {
    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 768,
      system:
        'You are an analyst that reads leadership coaching conversations and extracts a structured record. Return ONLY valid JSON with these exact fields:\n' +
        '- debt_primary: one of EVITACAO_CONFLITO | AUTORIDADE_FRAGILIZADA | COMUNICACAO_AMBIGUA | ACCOUNTABILITY_DILUIDA | DECISAO_POSTERGADA | CONFIANCA_EROSIONADA | APRENDIZADO_BLOQUEADO | ALINHAMENTO_SIMBOLICO | ENERGIA_EMOCIONAL | MATURIDADE_POLITICA\n' +
        '- debt_adjacent: same enum or null\n' +
        '- context_type: one of FEEDBACK | DECISAO | CONFLITO | ALINHAMENTO | CRISE | DELEGACAO | POLITICA | COMUNICACAO | GESTAO_TIME | CLIENTE | PARES | CHEFE | CARREIRA | OUTRO\n' +
        '- actor: one of LIDERADO | PAR | CHEFE | CLIENTE | TIME | OUTRO\n' +
        '- moment_phase: one of BEFORE | DURING | AFTER\n' +
        '- intensity: integer 1–5 (1=minimal, 5=critical)\n' +
        '- confidence: float 0–1 — your numerical confidence in this classification\n' +
        '- self_assessment: string — 1-2 sentences explaining your confidence level and any uncertainties (this will be used to measure classification accuracy over time)\n' +
        '- timestamp: ISO 8601 datetime string (current time)',
      messages: [{ role: "user", content: transcript }],
    });

    const rawText = response.content[0].type === "text" ? response.content[0].text : "{}";
    const parsed = JSON.parse(rawText.replace(/```json\n?|\n?```/g, "").trim());
    const validated = validateSed(parsed);

    if (!validated) {
      logger.error({ parsed }, "SED inválido: falha na validação do schema");
      return;
    }

    await db.insert(sedsTable).values({
      sessionId,
      organizationId,
      debtPrimary: validated.debt_primary,
      debtAdjacent: validated.debt_adjacent ?? undefined,
      contextType: validated.context_type,
      actor: validated.actor,
      momentPhase: validated.moment_phase,
      intensity: validated.intensity,
      confidence: validated.confidence,
      agentSelfAssessment: validated.self_assessment,
      lowConfidence,
      timestamp: new Date(validated.timestamp),
    });

    logger.info({ sessionId }, "SED salvo com sucesso");
  } catch (err) {
    logger.error({ err, sessionId }, "Erro ao gerar ou salvar SED");
  }
}

router.post("/session/message", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const user = req.user!;
  const { sessionId, content } = req.body;

  if (!sessionId || typeof content !== "string" || !content.trim()) {
    res.status(400).json({ error: "sessionId e content são obrigatórios." });
    return;
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(and(eq(sessionsTable.id, sessionId), eq(sessionsTable.organizationId, user.organizationId)));

  if (!session) {
    res.status(404).json({ error: "Sessão não encontrada." });
    return;
  }

  const exchangeCount = session.exchangeCount ?? 0;

  if (session.status === "closed" || exchangeCount >= MAX_EXCHANGES) {
    res.status(400).json({ error: "Session closed. Start a new conversation." });
    return;
  }

  const ctx = (session.context as SessionContext | null) ?? {
    messages: [],
    agentType: null,
    debtPrimary: null,
    debtAdjacent: null,
  };

  let agentType = ctx.agentType ?? session.agentType;
  let debtPrimary = ctx.debtPrimary;
  let debtAdjacent = ctx.debtAdjacent;
  let lowConfidence = false;

  // Step 1 & 2: Classify on first exchange
  if (exchangeCount === 0) {
    const [libraryMatch] = await db
      .select()
      .from(momentLibraryTable)
      .where(ilike(momentLibraryTable.exampleInput, `%${content.slice(0, 60)}%`))
      .limit(1);

    if (libraryMatch) {
      agentType = libraryMatch.agent;
      debtPrimary = libraryMatch.debtPrimary;
      debtAdjacent = libraryMatch.debtAdjacent ?? null;
      req.log.info({ agentType, source: "moment_library" }, "Agente classificado via biblioteca");
    } else {
      try {
        const classification = await classifyWithHaiku(content);
        agentType = classification.agent_type;
        debtPrimary = classification.debt_primary;
        debtAdjacent = classification.debt_adjacent;
        lowConfidence = classification.confidence < 0.6;
        req.log.info({ agentType, confidence: classification.confidence, source: "haiku" }, "Agente classificado via IA");
      } catch (err) {
        logger.warn({ err }, "Falha na classificação haiku, usando padrão MNT");
        agentType = "MNT";
        debtPrimary = "decisao-estrategica";
        lowConfidence = true;
      }
    }
  }

  // Step 3: Load system prompt (with wrap-up injection at exchange 8+)
  const systemPrompt = getSystemPrompt(agentType ?? "MNT", exchangeCount);

  // Step 4: Build conversation history
  const history: Message[] = ctx.messages ?? [];
  const userMessage: Message = { role: "user", content: content.trim() };
  const messagesForClaude = [...history, userMessage];

  // Start SSE stream
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  let fullResponse = "";

  try {
    const stream = anthropic.messages.stream({
      model: MODEL_SONNET,
      system: systemPrompt,
      max_tokens: 8192,
      messages: messagesForClaude,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        const token = event.delta.text;
        fullResponse += token;
        sendEvent({ type: "token", content: token });
      }
    }

    await stream.finalMessage();

    // Detect early-close signal from the model
    const trimmed = fullResponse.trimEnd();
    const earlyClose = trimmed.endsWith(CLOSE_SIGNAL);

    if (earlyClose) {
      // Strip the signal from what was sent — need to send a correction token
      fullResponse = trimmed.slice(0, -CLOSE_SIGNAL.length).trimEnd();
      // Send a negative-length correction isn't possible in SSE; instead we
      // send the closing suffix which will be appended after [ENCERRAR] in the
      // client buffer. We handle this by sending a special replace event.
      sendEvent({ type: "replace_last", content: fullResponse });
    }

    const newCount = exchangeCount + 1;
    const isClosing = earlyClose || newCount >= MAX_EXCHANGES;

    // Append closing message on final exchange (early or limit-reached)
    if (isClosing) {
      const closingSuffix = "\n\n" + CLOSING_MESSAGE;
      fullResponse += closingSuffix;
      sendEvent({ type: "token", content: closingSuffix });
    }

    // Step 5: Update session in DB
    const newMessages: Message[] = [
      ...messagesForClaude,
      { role: "assistant", content: fullResponse },
    ];

    if (isClosing) {
      await generateAndSaveSed(sessionId, user.organizationId, newMessages, lowConfidence);
      await db
        .update(sessionsTable)
        .set({
          agentType: agentType ?? "MNT",
          context: null,
          exchangeCount: newCount,
          status: "closed",
        })
        .where(eq(sessionsTable.id, sessionId));
    } else {
      await db
        .update(sessionsTable)
        .set({
          agentType: agentType ?? "MNT",
          context: {
            messages: newMessages,
            agentType,
            debtPrimary,
            debtAdjacent,
          } as unknown as Record<string, unknown>,
          exchangeCount: newCount,
          status: "active",
        })
        .where(eq(sessionsTable.id, sessionId));
    }

    sendEvent({
      type: "done",
      exchangeCount: newCount,
      maxExchanges: MAX_EXCHANGES,
      status: isClosing ? "closed" : "active",
      lowConfidence,
    });
  } catch (err) {
    logger.error({ err }, "Erro no streaming do agente");
    sendEvent({ type: "error", error: "Erro ao processar resposta do agente." });
  }

  res.end();
});

export default router;

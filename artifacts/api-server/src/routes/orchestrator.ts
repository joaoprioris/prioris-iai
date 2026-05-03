import { Router, type IRouter } from "express";
import { eq, and, ilike } from "drizzle-orm";
import { readFileSync } from "fs";
import { join } from "path";
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

const CORRECTION_PREFIX =
  "Parece que o que você precisa agora é diferente do que comecei abordando. Me conta mais sobre o que está acontecendo.\n\n";

// Confidence thresholds
const DISAMBIGUATION_THRESHOLD = 0.5; // below this → ask clarifying question
const LOW_CONFIDENCE_THRESHOLD = 0.6; // below this → flag lowConfidence

// Frustration signals (Rule 3) — checked as substrings, case-insensitive
const FRUSTRATION_SIGNALS = [
  "não é isso",
  "você não entendeu",
  "não era o que eu precisava",
  "errado",
  "não",
];

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

// ── Lens system ───────────────────────────────────────────────────────────────

type LensIntensity = "light" | "moderate" | "strong";
interface LensEntry { agent: string; intensity: LensIntensity; }
type LensMatrix = Record<string, LensEntry[]>;

const LENS_PLACEHOLDER = "Also consider the human impact on the people involved.";

const lensMatrix: LensMatrix = JSON.parse(
  readFileSync(join(process.cwd(), "lenses-matrix.json"), "utf-8"),
);

function getLensText(agent: string, intensity: LensIntensity): string {
  const envKey = `LENS_${agent}_${intensity.toUpperCase()}`;
  return process.env[envKey] ?? LENS_PLACEHOLDER;
}

function composeLenses(agentType: string): string[] {
  const entries = lensMatrix[agentType] ?? [];
  return entries.map((e) => getLensText(e.agent, e.intensity));
}

// ── Schema enums ──────────────────────────────────────────────────────────────

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

// ── SED validation ────────────────────────────────────────────────────────────

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

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SessionContext {
  messages: Message[];
  agentType: string | null;
  debtPrimary: string | null;
  debtAdjacent: string | null;
  // Disambiguation state (Rule 1 & 2)
  disambiguationPending: boolean;
  originalFirstMessage: string | null;
  // Frustration / re-classification tracking (Rule 3 & 4)
  reclassificationCount: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSystemPrompt(agentType: string, exchangeCount: number): string {
  const key = `PROMPT_${agentType}`;
  const corePrompt =
    process.env[key] ??
    `Você é o agente de suporte à decisão executiva IAí (${AGENT_LABELS[agentType as AgentType] ?? agentType}). Ajude o líder de forma direta, objetiva e respeitosa. Máximo de ${MAX_EXCHANGES} trocas por sessão.`;

  const lensTexts = composeLenses(agentType);

  const sessionContext = [
    `REGRA OBRIGATÓRIA: Nunca escreva a frase "${CLOSING_MESSAGE}" — ela será adicionada automaticamente pelo sistema na última troca. Se você a escrever, ela aparecerá duplicada.`,
    `ENCERRAMENTO ANTECIPADO: Se você perceber que o líder já alcançou clareza suficiente antes de ${MAX_EXCHANGES} trocas, você pode encerrar a conversa mais cedo. Para isso, termine sua resposta com exatamente "${CLOSE_SIGNAL}" na última linha. O sistema removerá esse marcador e adicionará a mensagem de encerramento automaticamente. Não use "${CLOSE_SIGNAL}" se a conversa ainda precisar continuar.`,
    ...(exchangeCount >= WRAP_UP_AT
      ? ["IMPORTANT: Begin wrapping up. Guide toward conclusion. 2 exchanges left."]
      : []),
  ].join("\n\n");

  const parts = [corePrompt, ...lensTexts, sessionContext];
  const composed = parts.join("\n\n");

  const approxTokens = Math.ceil(composed.length / 4);
  logger.info(
    { agentType, exchangeCount, lensCount: lensTexts.length, approxTokens },
    "System prompt composed",
  );

  return composed;
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

// Rule 1: Generate a single clarifying question in Portuguese
async function generateClarifyingQuestion(content: string): Promise<string> {
  try {
    const message = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 128,
      messages: [{
        role: "user",
        content: `Leader said: ${content}. Ask ONE short warm clarifying question in Brazilian Portuguese.\nExample: Isso está acontecendo agora ou você está se preparando?`,
      }],
    });
    return message.content[0].type === "text"
      ? message.content[0].text.trim()
      : "Pode me contar um pouco mais sobre o que está acontecendo?";
  } catch {
    return "Pode me contar um pouco mais sobre o que está acontecendo?";
  }
}

// Rule 3: Detect frustration signals in user message
function detectFrustration(content: string): boolean {
  const lower = content.toLowerCase();
  return FRUSTRATION_SIGNALS.some((signal) => lower.includes(signal));
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

// ── Route ─────────────────────────────────────────────────────────────────────

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

  // Initialise context with defaults for new fields so old sessions don't break
  const ctx: SessionContext = {
    messages: [],
    agentType: null,
    debtPrimary: null,
    debtAdjacent: null,
    disambiguationPending: false,
    originalFirstMessage: null,
    reclassificationCount: 0,
    ...((session.context as Partial<SessionContext> | null) ?? {}),
  };

  let agentType = ctx.agentType ?? session.agentType;
  let debtPrimary = ctx.debtPrimary;
  let debtAdjacent = ctx.debtAdjacent;
  let lowConfidence = false;
  let disambiguationPending = ctx.disambiguationPending;
  let originalFirstMessage = ctx.originalFirstMessage;
  let reclassificationCount = ctx.reclassificationCount;
  let isFrustrated = false;
  let askingClarification = false; // true when we short-circuit with a clarifying Q

  // ── Step 1: Classification / disambiguation / frustration ─────────────────

  if (disambiguationPending) {
    // Rule 1 follow-up: re-classify with combined input
    const combined = `${originalFirstMessage ?? ""}\n\n${content.trim()}`;
    try {
      const classification = await classifyWithHaiku(combined);
      if (classification.confidence < DISAMBIGUATION_THRESHOLD) {
        // Rule 2: still not confident → safe fallback to CTN
        agentType = "CTN";
        debtPrimary = "EVITACAO_CONFLITO";
        debtAdjacent = null;
        lowConfidence = true;
        req.log.info({ sessionId }, "Disambiguation still low confidence — routing to CTN");
      } else {
        agentType = classification.agent_type;
        debtPrimary = classification.debt_primary;
        debtAdjacent = classification.debt_adjacent;
        lowConfidence = classification.confidence < LOW_CONFIDENCE_THRESHOLD;
        req.log.info({ agentType, confidence: classification.confidence }, "Disambiguation resolved");
      }
    } catch (err) {
      logger.warn({ err }, "Falha na re-classificação de disambiguação, usando CTN");
      agentType = "CTN";
      lowConfidence = true;
    }
    disambiguationPending = false;
    originalFirstMessage = null;

  } else if (exchangeCount === 0) {
    // First exchange: library match then haiku
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
        req.log.info({ confidence: classification.confidence, agent: classification.agent_type }, "Haiku classification");

        if (classification.confidence < DISAMBIGUATION_THRESHOLD) {
          // Rule 1: confidence too low → ask clarifying question
          askingClarification = true;
          disambiguationPending = true;
          originalFirstMessage = content.trim();
          req.log.info({ sessionId, confidence: classification.confidence }, "Low confidence — asking clarifying question");
        } else {
          agentType = classification.agent_type;
          debtPrimary = classification.debt_primary;
          debtAdjacent = classification.debt_adjacent;
          lowConfidence = classification.confidence < LOW_CONFIDENCE_THRESHOLD;
          req.log.info({ agentType, source: "haiku" }, "Agente classificado via IA");
        }
      } catch (err) {
        logger.warn({ err }, "Falha na classificação haiku, usando padrão MNT");
        agentType = "MNT";
        debtPrimary = "decisao-estrategica";
        lowConfidence = true;
      }
    }

  } else {
    // Exchange > 0 and not in disambiguation: check frustration (Rule 3)
    if (detectFrustration(content)) {
      isFrustrated = true;
      // Re-classify with first user message + correction
      const firstUserMsg = ctx.messages.find((m) => m.role === "user")?.content ?? content;
      const combined = `${firstUserMsg}\n\n[Correção do usuário]: ${content.trim()}`;
      try {
        const classification = await classifyWithHaiku(combined);
        agentType = classification.agent_type;
        debtPrimary = classification.debt_primary;
        debtAdjacent = classification.debt_adjacent;
        lowConfidence = classification.confidence < LOW_CONFIDENCE_THRESHOLD;
        reclassificationCount += 1;
        req.log.info(
          { agentType, reclassificationCount, sessionId },
          "Frustration detected — agent re-classified",
        );

        // Rule 4: flag incident after 2+ re-classifications
        if (reclassificationCount >= 2) {
          req.log.warn({ sessionId, reclassificationCount }, "Incident: repeated reclassification");
          await db
            .update(sessionsTable)
            .set({ incident: true, incidentReason: "repeated reclassification" })
            .where(eq(sessionsTable.id, sessionId));
        }
      } catch (err) {
        logger.warn({ err }, "Falha na re-classificação de frustração");
        // Keep existing agentType
      }
    }
  }

  // ── Step 2: Start SSE stream ──────────────────────────────────────────────

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const newCount = exchangeCount + 1;

  // ── Step 3a: Clarifying question short-circuit (Rule 1) ───────────────────

  if (askingClarification) {
    try {
      const question = await generateClarifyingQuestion(content);
      sendEvent({ type: "token", content: question });

      const userMessage: Message = { role: "user", content: content.trim() };
      const assistantMessage: Message = { role: "assistant", content: question };

      await db
        .update(sessionsTable)
        .set({
          agentType: agentType ?? "MNT",
          context: {
            ...ctx,
            messages: [...ctx.messages, userMessage, assistantMessage],
            disambiguationPending: true,
            originalFirstMessage,
            reclassificationCount,
          } as unknown as Record<string, unknown>,
          exchangeCount: newCount,
          status: "active",
        })
        .where(eq(sessionsTable.id, sessionId));

      sendEvent({ type: "done", exchangeCount: newCount, maxExchanges: MAX_EXCHANGES, status: "active", lowConfidence: true });
    } catch (err) {
      logger.error({ err }, "Erro ao gerar pergunta de clarificação");
      sendEvent({ type: "error", error: "Erro ao processar sua mensagem." });
    }
    res.end();
    return;
  }

  // ── Step 3b: Main agent call ──────────────────────────────────────────────

  const systemPrompt = getSystemPrompt(agentType ?? "MNT", exchangeCount);
  const history: Message[] = ctx.messages ?? [];
  const userMessage: Message = { role: "user", content: content.trim() };
  const messagesForClaude = [...history, userMessage];

  let fullResponse = "";

  try {
    // Rule 3: prepend correction message before streaming agent response
    if (isFrustrated) {
      fullResponse += CORRECTION_PREFIX;
      sendEvent({ type: "token", content: CORRECTION_PREFIX });
    }

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

    // Detect early-close signal
    const trimmed = fullResponse.trimEnd();
    const earlyClose = trimmed.endsWith(CLOSE_SIGNAL);

    if (earlyClose) {
      fullResponse = trimmed.slice(0, -CLOSE_SIGNAL.length).trimEnd();
      sendEvent({ type: "replace_last", content: fullResponse });
    }

    const isClosing = earlyClose || newCount >= MAX_EXCHANGES;

    if (isClosing) {
      const closingSuffix = "\n\n" + CLOSING_MESSAGE;
      fullResponse += closingSuffix;
      sendEvent({ type: "token", content: closingSuffix });
    }

    // ── Step 4: Persist session ─────────────────────────────────────────────

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
            disambiguationPending,
            originalFirstMessage,
            reclassificationCount,
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

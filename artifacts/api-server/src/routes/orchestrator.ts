import { Router, type IRouter } from "express";
import { eq, and, ilike } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { db, sessionsTable, momentLibraryTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const MAX_EXCHANGES = 10;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

function getSystemPrompt(agentType: string): string {
  const key = `PROMPT_${agentType}`;
  return (
    process.env[key] ??
    `Você é o agente de suporte à decisão executiva IAí (${AGENT_LABELS[agentType as AgentType] ?? agentType}). Ajude o líder de forma direta, objetiva e respeitosa. Máximo de ${MAX_EXCHANGES} trocas por sessão.`
  );
}

async function classifyWithHaiku(content: string): Promise<{
  agent_type: string;
  debt_primary: string;
  debt_adjacent: string | null;
  confidence: number;
}> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
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
    res.status(400).json({ error: "Limite de trocas atingido. Inicie uma nova sessão." });
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
    // Step 1: Try moment_library match
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
      // Step 2: Claude haiku classification
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

  // Step 3: Load system prompt
  const systemPrompt = getSystemPrompt(agentType ?? "MNT");

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
    // Step 5: Stream from Claude Sonnet
    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      system: systemPrompt,
      max_tokens: 1024,
      messages: messagesForClaude,
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        const token = event.delta.text;
        fullResponse += token;
        sendEvent({ type: "token", content: token });
      }
    }

    await stream.finalMessage();

    // Update session in DB
    const newMessages: Message[] = [
      ...messagesForClaude,
      { role: "assistant", content: fullResponse },
    ];
    const newCount = exchangeCount + 1;
    const newStatus = newCount >= MAX_EXCHANGES ? "closed" : "active";

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
        status: newStatus,
      })
      .where(eq(sessionsTable.id, sessionId));

    sendEvent({
      type: "done",
      exchangeCount: newCount,
      maxExchanges: MAX_EXCHANGES,
      status: newStatus,
      lowConfidence,
    });
  } catch (err) {
    logger.error({ err }, "Erro no streaming do agente");
    sendEvent({ type: "error", error: "Erro ao processar resposta do agente." });
  }

  res.end();
});

export default router;

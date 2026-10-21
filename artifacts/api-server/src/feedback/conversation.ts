import {
  CLOSING_PHRASE,
  FEEDBACK_GUIDANCE,
  CLOSING_QUESTION_RETRY_INSTRUCTION,
  FORBIDDEN_IN_REPLIES,
  FORBIDDEN_RETRY_INSTRUCTION,
  LAST_EXCHANGE_INSTRUCTION,
  MAX_EXCHANGES,
} from "./guidance.ts";

export const MAX_USER_MESSAGE_CHARS = 4000;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface FeedbackProvider {
  complete(input: { system: string; messages: ChatMessage[] }): Promise<string>;
}

export type TurnResult =
  | {
      status: "ok";
      reply: string;
      exchange: number;
      closed: boolean;
      history: ChatMessage[];
    }
  | { status: "closed" }
  | { status: "invalid"; reason: "empty" | "too_long" }
  | { status: "error" };

/** Uma troca é uma mensagem do líder mais a resposta do IAí. */
export function countExchanges(history: ChatMessage[]): number {
  return history.filter((message) => message.role === "user").length;
}

export function isClosed(history: ChatMessage[]): boolean {
  if (countExchanges(history) >= MAX_EXCHANGES) return true;
  const last = history[history.length - 1];
  return last?.role === "assistant" && last.content.trimEnd().endsWith(CLOSING_PHRASE);
}

/** Remove só as perguntas que fecham o texto; perguntas no meio ou dentro de aspas ficam como estão. */
export function stripTrailingQuestions(text: string): string {
  let result = text.trim();
  for (;;) {
    const match = result.match(/(^|[.!?\n])[^.!?\n]*\?$/);
    if (!match) break;
    const next = result.slice(0, match.index! + (match[1] ? match[1].length : 0)).trim();
    if (!next) break;
    result = next;
  }
  return result;
}

function withClosingPhrase(reply: string): string {
  const text = reply.trim();
  return text.endsWith(CLOSING_PHRASE) ? text : `${text}\n\n${CLOSING_PHRASE}`;
}

/**
 * Executa uma troca. O histórico é global: a contagem das dez trocas não reinicia
 * quando outro agente assumir no futuro. Falha do provider não consome troca.
 */
export async function runTurn(
  provider: FeedbackProvider,
  history: ChatMessage[],
  userMessage: string,
): Promise<TurnResult> {
  const content = userMessage.trim();
  if (!content) return { status: "invalid", reason: "empty" };
  if (content.length > MAX_USER_MESSAGE_CHARS) return { status: "invalid", reason: "too_long" };
  if (isClosed(history)) return { status: "closed" };

  const exchange = countExchanges(history) + 1;
  const isLast = exchange === MAX_EXCHANGES;
  const system = isLast ? `${FEEDBACK_GUIDANCE}\n\n${LAST_EXCHANGE_INSTRUCTION}` : FEEDBACK_GUIDANCE;
  const messages: ChatMessage[] = [...history, { role: "user", content }];

  const hasForbidden = (text: string) => FORBIDDEN_IN_REPLIES.some((pattern) => pattern.test(text));

  let raw: string;
  try {
    raw = await provider.complete({ system, messages });
    // Vocabulário vetado nunca chega ao líder: uma nova tentativa avisada e, se persistir, erro sem consumir troca.
    if (hasForbidden(raw ?? "")) {
      raw = await provider.complete({
        system: `${system}\n\n${FORBIDDEN_RETRY_INSTRUCTION}`,
        messages,
      });
      if (hasForbidden(raw ?? "")) return { status: "error" };
    }
    // Encerrar com pergunta deixa o líder sem como responder: uma nova tentativa sem interrogação.
    const closing = isLast || raw.trimEnd().endsWith(CLOSING_PHRASE);
    if (closing && raw.replace(CLOSING_PHRASE, "").includes("?")) {
      const again = await provider.complete({
        system: `${system}\n\n${CLOSING_QUESTION_RETRY_INSTRUCTION}`,
        messages,
      });
      if (again && again.trim() && !hasForbidden(again)) raw = again;
      // Se a resposta ainda terminar em pergunta, essa pergunta final sai da resposta de encerramento.
      raw = stripTrailingQuestions(raw);
    }
  } catch {
    return { status: "error" };
  }
  if (!raw || !raw.trim()) return { status: "error" };

  const reply = isLast ? withClosingPhrase(raw) : raw.trim();
  const closed = reply.endsWith(CLOSING_PHRASE);
  return {
    status: "ok",
    reply,
    exchange,
    closed,
    history: [...messages, { role: "assistant", content: reply }],
  };
}

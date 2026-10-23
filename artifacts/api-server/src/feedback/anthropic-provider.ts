import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, FeedbackProvider } from "./conversation.ts";

export type Effort = "low" | "medium" | "high";

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens?: number;
  cacheReadTokens?: number;
}

export interface LlmCall {
  model: string;
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  effort: Effort;
  /** Cache automático do prefixo (instrução e histórico). Só vale a pena em prefixos de 512 tokens ou mais. */
  cache?: boolean;
}

type MessagesClient = Pick<Anthropic, "messages">;

/**
 * O SDK instalado é anterior a output_config, então o corpo é montado à parte.
 * Resposta cortada ou recusada vira erro: texto parcial nunca chega ao líder.
 */
export async function callAnthropic(
  client: MessagesClient,
  call: LlmCall,
): Promise<{ text: string; usage: Usage }> {
  const body = {
    model: call.model,
    max_tokens: call.maxTokens,
    system: call.system,
    messages: call.messages,
    output_config: { effort: call.effort },
    ...(call.cache ? { cache_control: { type: "ephemeral" } } : {}),
  };
  const response = await client.messages.create(
    body as unknown as Anthropic.MessageCreateParamsNonStreaming,
  );
  if (response.stop_reason === "max_tokens" || (response.stop_reason as string) === "refusal") {
    const blocks = response.content.map((block) => block.type).join(",");
    throw new Error(
      `resposta incompleta: ${response.stop_reason} (modelo ${call.model}, limite ${call.maxTokens}, saída ${response.usage.output_tokens}, blocos ${blocks})`,
    );
  }
  const text = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();
  const usage = response.usage as unknown as {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  };
  return {
    text,
    usage: {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
      cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    },
  };
}

/**
 * Provider direto da Anthropic. O modelo é escolhido pelo dono via PRIORIS_FEEDBACK_MODEL,
 * porque o custo por rodada de avaliação tem teto definido por ele.
 */
export function createAnthropicProvider(options: {
  model: string;
  effort?: Effort;
  maxTokens?: number;
  client: MessagesClient;
}): FeedbackProvider {
  return {
    async complete({ system, messages }) {
      const { text } = await callAnthropic(options.client, {
        model: options.model,
        system,
        messages,
        maxTokens: options.maxTokens ?? 1500,
        effort: options.effort ?? "low",
        cache: true,
      });
      return text;
    },
  };
}

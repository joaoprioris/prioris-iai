import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, FeedbackProvider } from "./conversation.ts";

export type Effort = "low" | "medium" | "high";

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmCall {
  model: string;
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  effort: Effort;
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
  };
  const response = await client.messages.create(
    body as unknown as Anthropic.MessageCreateParamsNonStreaming,
  );
  if (response.stop_reason === "max_tokens" || (response.stop_reason as string) === "refusal") {
    throw new Error(`resposta incompleta: ${response.stop_reason}`);
  }
  const text = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();
  return {
    text,
    usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
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
      });
      return text;
    },
  };
}

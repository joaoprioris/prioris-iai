import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, FeedbackProvider } from "./conversation.ts";

const MAX_OUTPUT_TOKENS = 700;

/**
 * Provider direto da Anthropic. O modelo é escolhido pelo dono via PRIORIS_FEEDBACK_MODEL,
 * porque o custo por rodada de avaliação tem teto definido por ele.
 */
export function createAnthropicProvider(options: {
  apiKey: string;
  model: string;
  client?: Pick<Anthropic, "messages">;
}): FeedbackProvider {
  const client = options.client ?? new Anthropic({ apiKey: options.apiKey });
  return {
    async complete({ system, messages }: { system: string; messages: ChatMessage[] }) {
      const response = await client.messages.create({
        model: options.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system,
        messages,
      });
      return response.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("")
        .trim();
    },
  };
}

import type { Usage } from "../anthropic-provider.ts";

/**
 * Preços de lista em USD por milhão de tokens (tabela de 06/10/2026) e multiplicador de leitura de cache
 * conforme a página oficial de prompt caching. Escrita no cache de 5 minutos custa 1,25x o preço de entrada.
 * Conferir antes de rodadas novas.
 */
export const PRICES_USD_PER_MTOK: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.1 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.05 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.05 },
  "claude-fable-5-1": { input: 10, output: 50, cacheRead: 0.025 },
};

const CACHE_WRITE_MULTIPLIER = 1.25;

export const DEFAULT_CAP_USD = 5;

export class BudgetExceeded extends Error {}

/** Estimativa conservadora: um token a cada 2,5 caracteres. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2.5);
}

function priceOf(model: string) {
  const price = PRICES_USD_PER_MTOK[model];
  if (!price) throw new Error(`sem preço cadastrado para o modelo ${model}`);
  return price;
}

export function costUsd(model: string, usage: Usage): number {
  const price = priceOf(model);
  const write = (usage.cacheWriteTokens ?? 0) * price.input * CACHE_WRITE_MULTIPLIER;
  const read = (usage.cacheReadTokens ?? 0) * price.input * price.cacheRead;
  return (usage.inputTokens * price.input + write + read + usage.outputTokens * price.output) / 1_000_000;
}

/** Trava dura: recusa a chamada se o pior caso estourar o teto definido pelo dono. */
export class BudgetGuard {
  spentUsd: number;
  calls = 0;
  readonly capUsd: number;

  /** O teto vale para o total de todas as rodadas; spentBeforeUsd carrega o que já foi gasto. */
  constructor(capUsd: number = DEFAULT_CAP_USD, spentBeforeUsd = 0) {
    this.capUsd = capUsd;
    this.spentUsd = spentBeforeUsd;
  }

  reserve(model: string, inputText: string, maxOutputTokens: number): void {
    // Pior caso: toda a entrada é escrita em cache, que é o caso mais caro.
    const worst = costUsd(model, {
      inputTokens: 0,
      cacheWriteTokens: estimateTokens(inputText),
      outputTokens: maxOutputTokens,
    });
    if (this.spentUsd + worst > this.capUsd) {
      throw new BudgetExceeded(
        `teto de US$ ${this.capUsd.toFixed(2)} seria excedido (gasto US$ ${this.spentUsd.toFixed(4)})`,
      );
    }
  }

  record(model: string, usage: Usage): void {
    this.spentUsd += costUsd(model, usage);
    this.calls += 1;
  }
}

type CreateBody = { model: string; max_tokens: number; system?: unknown; messages?: unknown };

/**
 * Envolve o cliente da Anthropic: reserva o pior caso antes de cada chamada e registra o uso real depois.
 * Qualquer chamada da rodada (agente, líder simulado, avaliador) passa por aqui.
 */
export function guardClient<T extends { messages: { create: (body: never) => Promise<unknown> } }>(
  client: T,
  guard: BudgetGuard,
): T {
  const create = client.messages.create.bind(client.messages);
  const guarded = async (body: CreateBody) => {
    guard.reserve(body.model, JSON.stringify([body.system, body.messages]), body.max_tokens);
    const response = (await create(body as never)) as {
      usage: {
        input_tokens: number;
        output_tokens: number;
        cache_creation_input_tokens?: number | null;
        cache_read_input_tokens?: number | null;
      };
    };
    guard.record(body.model, {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    });
    return response;
  };
  return { ...client, messages: { ...client.messages, create: guarded } } as unknown as T;
}

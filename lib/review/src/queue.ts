import type { Envelope } from "./auth.ts";
import { Rejected } from "./errors.ts";
import { isPermanentDatabaseError, type PersistResult } from "./persist.ts";

export interface EnvelopeQueue {
  publish(envelope: Envelope): Promise<void>;
}

export interface Quarantined {
  envelope: Envelope;
  reason: string;
}

/** Fila em memória para teste e desenvolvimento. Produção usa SQS ou Pub/Sub atrás da mesma interface. */
export class InMemoryQueue implements EnvelopeQueue {
  readonly pending: { envelope: Envelope; attempts: number }[] = [];
  readonly deadLetter: Quarantined[] = [];
  async publish(envelope: Envelope): Promise<void> {
    this.pending.push({ envelope, attempts: 0 });
  }
}

export interface DrainSummary {
  inserted: number;
  duplicate: number;
  quarantined: number;
  retried: number;
}

/**
 * Consome até esvaziar. Erro permanente vai para quarentena sem repetir; erro transitório repete até
 * `maxAttempts` e então vai para a DLQ. Nada é confirmado antes do commit de `handle`.
 */
export async function drain(
  queue: InMemoryQueue,
  handle: (envelope: Envelope) => Promise<PersistResult>,
  maxAttempts = 3,
): Promise<DrainSummary> {
  const summary: DrainSummary = { inserted: 0, duplicate: 0, quarantined: 0, retried: 0 };
  while (queue.pending.length) {
    const item = queue.pending.shift()!;
    try {
      const result = await handle(item.envelope);
      summary[result] += 1;
    } catch (error) {
      if (error instanceof Rejected || isPermanentDatabaseError(error)) {
        queue.deadLetter.push({ envelope: item.envelope, reason: "permanent" });
        summary.quarantined += 1;
      } else if (item.attempts + 1 >= maxAttempts) {
        queue.deadLetter.push({ envelope: item.envelope, reason: "retries exhausted" });
        summary.quarantined += 1;
      } else {
        item.attempts += 1;
        queue.pending.push(item);
        summary.retried += 1;
      }
    }
  }
  return summary;
}

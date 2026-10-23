import type { Client } from "pg";
import type { Envelope } from "./auth.ts";
import { cycleStart } from "./contract.ts";
import { EventConflict, Rejected } from "./errors.ts";

export type PersistResult = "inserted" | "duplicate";

/**
 * `connect` deve devolver um cliente com papel sem privilégios de proprietário, TLS verificável e timeouts.
 * O tenant é definido aqui, por transação, a partir da credencial já autenticada.
 */
export type Connect = () => Promise<Client>;

const SED_COLUMNS =
  "client_id,event_id,payload_digest,group_id,contributor_token,occurred_at,cycle_start,debt_principal,debt_adjacent,context,actor,momento,intensity_proxy";
const SURVEY_COLUMNS =
  "client_id,event_id,payload_digest,group_id,contributor_token,occurred_at,cycle_start,question_id,answer";

/**
 * Persiste em transação única. Reentrega de evento já gravado devolve "duplicate", inclusive com o ciclo
 * encerrado. O mesmo event_id com bytes diferentes é conflito (erro permanente). Falhas de infraestrutura
 * propagam como erro comum para a fila repetir; nada é confirmado antes do commit.
 */
export async function persist(envelope: Envelope, connect: Connect): Promise<PersistResult> {
  const { tenant, event, digest } = envelope;
  if (!/^[0-9a-f]{64}$/.test(digest)) throw new Rejected("invalid digest");
  const table = event.kind === "sed" ? "sed_events" : "survey_answers";
  const cycle = cycleStart(event.occurred);
  const client = await connect();
  try {
    await client.query("BEGIN");
    try {
      await client.query("SELECT set_config('app.tenant', $1, true)", [tenant]);
      await client.query("SET LOCAL statement_timeout = '5s'");
      await client.query("SET LOCAL lock_timeout = '3s'");

      const existing = await client.query(
        `SELECT payload_digest FROM prioris_review.${table} WHERE client_id=$1 AND event_id=$2`,
        [tenant, event.event_id],
      );
      if (existing.rowCount) {
        if (existing.rows[0].payload_digest !== digest) throw new EventConflict("event id reused with different bytes");
        await client.query("COMMIT");
        return "duplicate";
      }

      const values =
        event.kind === "sed"
          ? [tenant, event.event_id, digest, event.group_id, event.contributor_token, event.occurred, cycle,
             event.debt_principal, event.debt_adjacent, event.context, event.actor, event.momento, event.intensity_proxy]
          : [tenant, event.event_id, digest, event.group_id, event.contributor_token, event.occurred, cycle,
             event.question_id, event.answer];
      const columns = event.kind === "sed" ? SED_COLUMNS : SURVEY_COLUMNS;
      const placeholders = values.map((_, index) => `$${index + 1}`).join(",");
      const inserted = await client.query(
        `INSERT INTO prioris_review.${table} (${columns}) VALUES (${placeholders})
         ON CONFLICT (client_id,event_id) DO NOTHING RETURNING event_id`,
        values,
      );
      if (inserted.rowCount) {
        await client.query("COMMIT");
        return "inserted";
      }
      // Corrida: outra entrega gravou entre a leitura e a inserção.
      const again = await client.query(
        `SELECT payload_digest FROM prioris_review.${table} WHERE client_id=$1 AND event_id=$2`,
        [tenant, event.event_id],
      );
      if (!again.rowCount || again.rows[0].payload_digest !== digest)
        throw new EventConflict("event id reused with different bytes");
      await client.query("COMMIT");
      return "duplicate";
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** Erro 23514 (ciclo encerrado ou inexistente) e 23503 (grupo ou ciclo não cadastrado) são permanentes. */
export function isPermanentDatabaseError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "23514" || code === "23503" || code === "23505" || code === "22P02";
}

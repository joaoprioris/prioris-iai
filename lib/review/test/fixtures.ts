import { sign } from "../src/auth.ts";
import type { ResolveKey } from "../src/auth.ts";

export const SECRET_A = Buffer.alloc(32, 7);
export const SECRET_B = Buffer.alloc(32, 9);

export const resolveKey: ResolveKey = (keyId) => {
  if (keyId === "key_a") return { tenant: "cli_a", secret: SECRET_A };
  if (keyId === "key_b") return { tenant: "cli_b", secret: SECRET_B };
  throw new Error("unknown key");
};

export const token = (n: number): string => n.toString(16).padStart(64, "0");

export const monthStart = (offset: number, from: Date = new Date()): Date =>
  new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + offset, 1));

export const iso = (date: Date): string => date.toISOString();

export function sedPayload(overrides: Record<string, unknown> = {}, at: Date = new Date(Date.now() - 60_000)) {
  return {
    schema_version: 3,
    kind: "sed",
    event_id: "evt_1",
    timestamp: iso(at),
    client_id: "cli_a",
    group_id: 1,
    contributor_token: token(1),
    debt_principal: 1,
    debt_adjacent: 3,
    context: "feedback",
    actor: "liderado",
    momento: "Antes",
    intensity_proxy: "Media",
    ...overrides,
  };
}

export function surveyPayload(overrides: Record<string, unknown> = {}, at: Date = new Date(Date.now() - 60_000)) {
  return {
    schema_version: 3,
    kind: "survey",
    event_id: "svy_1",
    timestamp: iso(at),
    client_id: "cli_a",
    group_id: 1,
    contributor_token: token(1),
    question_id: "A1",
    answer: 3,
    ...overrides,
  };
}

export function signedRequest(
  payload: unknown,
  options: { keyId?: string; secret?: Buffer; sentAt?: number; raw?: Buffer } = {},
) {
  const raw = options.raw ?? Buffer.from(JSON.stringify(payload), "utf8");
  const sentAt = String(options.sentAt ?? Math.floor(Date.now() / 1000));
  const secret = options.secret ?? SECRET_A;
  return {
    raw,
    headers: {
      "x-prioris-key-id": options.keyId ?? "key_a",
      "x-prioris-timestamp": sentAt,
      "x-prioris-signature": sign(secret, sentAt, raw),
    },
  };
}

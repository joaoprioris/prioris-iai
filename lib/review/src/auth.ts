import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { validateEvent, type ValidEvent } from "./contract.ts";
import { Rejected } from "./errors.ts";

export const MAX_BODY_BYTES = 16384;
export const MAX_DELIVERY_SKEW_SECONDS = 300;

export interface Envelope {
  tenant: string;
  event: ValidEvent;
  digest: string;
}

/** Resolve a credencial em cadastro confiável do servidor. Chave desconhecida deve lançar (falha fechada). */
export type ResolveKey = (keyId: string) => { tenant: string; secret: Buffer };

export function sign(secret: Buffer, sentAt: string, raw: Buffer): string {
  return createHmac("sha256", secret).update(sentAt, "ascii").update(".").update(raw).digest("hex");
}

function equalHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "ascii");
  const right = Buffer.from(b, "ascii");
  return left.length === right.length && timingSafeEqual(left, right);
}

/** JSON.parse mantém a última chave repetida; aqui chave duplicada no mesmo objeto é rejeitada. */
function parseRejectingDuplicateKeys(text: string): unknown {
  const scopes: Set<string>[] = [];
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === "{") scopes.push(new Set());
    else if (char === "}") scopes.pop();
    else if (char === '"') {
      let end = index + 1;
      while (end < text.length && text[end] !== '"') end += text[end] === "\\" ? 2 : 1;
      const isKey = /^\s*:/.test(text.slice(end + 1, end + 64));
      const scope = scopes[scopes.length - 1];
      if (isKey && scope) {
        const key = text.slice(index + 1, end);
        if (scope.has(key)) throw new Rejected("duplicate JSON key");
        scope.add(key);
      }
      index = end;
    }
  }
  return JSON.parse(text);
}

/**
 * Autentica os bytes originais e só então interpreta e valida o JSON.
 * Falhas de autenticação viram 401, de formato 400. Nada malformado chega à fila.
 */
export function authenticate(
  raw: Buffer,
  headers: Record<string, string | undefined>,
  resolveKey: ResolveKey,
  now: number = Date.now() / 1000,
): Envelope {
  if (!Buffer.isBuffer(raw) || raw.length === 0 || raw.length > MAX_BODY_BYTES) throw new Rejected("invalid body size");
  const normalized = new Map<string, string>();
  for (const [name, value] of Object.entries(headers)) {
    const lowered = name.toLowerCase();
    if (normalized.has(lowered)) throw new Rejected("invalid headers");
    if (typeof value === "string") normalized.set(lowered, value);
  }
  const keyId = normalized.get("x-prioris-key-id") ?? "";
  const sentAt = normalized.get("x-prioris-timestamp") ?? "";
  const signature = normalized.get("x-prioris-signature") ?? "";
  if (!/^[0-9]{10}$/.test(sentAt) || Math.abs(now - Number(sentAt)) > MAX_DELIVERY_SKEW_SECONDS)
    throw new Rejected("stale delivery", 401);
  if (!/^[0-9a-f]{64}$/.test(signature)) throw new Rejected("invalid signature encoding", 401);
  let credential: { tenant: string; secret: Buffer };
  try {
    credential = resolveKey(keyId);
  } catch {
    throw new Rejected("unknown key", 401);
  }
  if (!Buffer.isBuffer(credential.secret) || credential.secret.length < 32)
    throw new Error("invalid signing key configuration");
  if (!equalHex(sign(credential.secret, sentAt, raw), signature)) throw new Rejected("signature mismatch", 401);

  let payload: unknown;
  try {
    payload = parseRejectingDuplicateKeys(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  } catch (error) {
    if (error instanceof Rejected) throw error;
    throw new Rejected("invalid JSON");
  }
  const event = validateEvent(payload, credential.tenant, now);
  return { tenant: credential.tenant, event, digest: createHash("sha256").update(raw).digest("hex") };
}

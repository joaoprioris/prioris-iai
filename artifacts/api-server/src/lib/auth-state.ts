import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
export const LOGIN_TTL_MS = 10 * 60 * 1000;
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const SESSION_COOKIE = "iai_session";
function isLoopback(url: URL): boolean {
  return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}
export function localHttpEnabled(): boolean {
  if (process.env.NODE_ENV !== "development" || process.env.IAI_LOCAL_HTTP !== "true") return false;
  try {
    const base = new URL(process.env.APP_BASE_URL ?? "");
    return base.protocol === "http:" && isLoopback(base);
  } catch { return false; }
}
export const COOKIE_OPTIONS = { httpOnly: true, secure: !localHttpEnabled(), sameSite: "strict" as const, path: "/api" };
type Credential = { hash: string; expiresAt: number };
export type AuthState = { v: 2; pending: Credential | null; session: Credential | null };
export const emptyAuthState = (): AuthState => ({ v: 2, pending: null, session: null });
export const isOpaqueToken = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
export const digestToken = (token: string): string => createHash("sha256").update(token).digest("hex");
export const newToken = (): string => randomBytes(32).toString("hex");
function validCredential(value: unknown): value is Credential {
  if (!value || typeof value !== "object") return false;
  const c = value as Credential;
  return isOpaqueToken(c.hash) && Number.isSafeInteger(c.expiresAt) && c.expiresAt > 0;
}
export function parseAuthState(value: string | null | undefined): AuthState | null {
  if (!value) return null;
  try {
    const state = JSON.parse(value) as AuthState;
    if (state?.v !== 2 || !(state.pending === null || validCredential(state.pending)) || !(state.session === null || validCredential(state.session))) return null;
    return state;
  } catch { return null; }
}
export function serializeAuthState(state: AuthState): string {
  const copy = (c: Credential | null) => c ? { hash: c.hash, expiresAt: c.expiresAt } : null;
  return JSON.stringify({ v: 2, pending: copy(state.pending), session: copy(state.session) });
}
export function credentialMatches(state: AuthState | null, kind: "pending" | "session", token: unknown, now = Date.now()): boolean {
  if (!state || !isOpaqueToken(token)) return false;
  const credential = state[kind];
  if (!credential || credential.expiresAt <= now) return false;
  return timingSafeEqual(Buffer.from(credential.hash, "hex"), Buffer.from(digestToken(token), "hex"));
}
export function issueLogin(state: AuthState, token: string, now = Date.now()): AuthState {
  return { v: 2, pending: { hash: digestToken(token), expiresAt: now + LOGIN_TTL_MS }, session: state.session && state.session.expiresAt > now ? state.session : null };
}
export function issueSession(token: string, now = Date.now()): AuthState {
  return { v: 2, pending: null, session: { hash: digestToken(token), expiresAt: now + SESSION_TTL_MS } };
}
export function isSameOrigin(headers: Record<string, unknown>): boolean {
  if (typeof headers.origin !== "string" || typeof headers.host !== "string") return false;
  try { const url = new URL(headers.origin); const local = localHttpEnabled(); const protocolAllowed = url.protocol === "https:" || (local && url.protocol === "http:" && isLoopback(url)); const configured = [process.env.APP_BASE_URL ?? "https://leadership-support-tool--joaoprioris.replit.app", process.env.AUTH_PREVIEW_ORIGIN].filter((value): value is string => Boolean(value)); return protocolAllowed && (url.host === headers.host || configured.some(value => { try { const allowed = new URL(value); return (allowed.protocol === "https:" || (local && allowed.protocol === "http:" && isLoopback(allowed))) && allowed.origin === url.origin; } catch { return false; } })); } catch { return false; }
}
export function requestCredential(headers: Record<string, unknown>, cookies: Record<string, unknown> | undefined): { token: string | null; cookie: boolean } {
  const bearer = typeof headers.authorization === "string" && headers.authorization.startsWith("Bearer ") ? headers.authorization.slice(7) : null;
  if (isOpaqueToken(bearer)) return { token: bearer, cookie: false };
  const cookie = cookies?.[SESSION_COOKIE];
  return { token: isOpaqueToken(cookie) ? cookie : null, cookie: true };
}
export class RequestLimiter {
  private buckets = new Map<string, { count: number; until: number }>();
  constructor(private clock: () => number = Date.now) {}
  take(key: string, max: number, windowMs: number): boolean {
    const now = this.clock();
    if (this.buckets.size >= 5000) {
      for (const [id, bucket] of this.buckets) if (bucket.until <= now) this.buckets.delete(id);
      if (!this.buckets.has(key) && this.buckets.size >= 5000) return false;
    }
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.until <= now) { this.buckets.set(key, { count: 1, until: now + windowMs }); return true; }
    if (bucket.count >= max) return false;
    bucket.count++; return true;
  }
}

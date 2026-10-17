import test from "node:test";
import assert from "node:assert/strict";

test("HTTP local exige desenvolvimento, sinal explícito e loopback", async () => {
  process.env.NODE_ENV = "development";
  process.env.IAI_LOCAL_HTTP = "true";
  process.env.APP_BASE_URL = "http://localhost:5173";
  const auth = await import("../artifacts/api-server/src/lib/auth-state.ts");
  assert.equal(auth.COOKIE_OPTIONS.secure, false);
  assert.equal(auth.isSameOrigin({ origin: "http://localhost:5173", host: "localhost:5173" }), true);
  assert.equal(auth.isSameOrigin({ origin: "http://example.com", host: "example.com" }), false);
  process.env.NODE_ENV = "production";
  assert.equal(auth.isSameOrigin({ origin: "http://localhost:5173", host: "localhost:5173" }), false);
});

test("falha do Anthropic direto é propagada sem fallback para Replit", async () => {
  process.env.DATABASE_URL = "postgresql://localhost:1/unused";
  process.env.PRIORIS_AI_PROVIDER = "anthropic";
  const { createModelProviders } = await import("../artifacts/api-server/src/routes/functional-orchestrator.ts");
  const expected = new Error("provider unavailable");
  const providers = createModelProviders({
    client: { messages: { create: async () => { throw expected; } } } as never,
  });
  await assert.rejects(
    providers.classify({ messages: [{ role: "user", content: "Cenário fictício." }], history: [], previousAgent: null, functionalNeed: null }),
    (error: unknown) => error === expected,
  );
});

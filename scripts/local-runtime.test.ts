import test from "node:test";
import assert from "node:assert/strict";
import { runtimeHost } from "./local-runtime-config.cjs";

test("perfil HTTP local vincula API e Vite ao loopback; demais perfis preservam bind remoto", () => {
  const local={NODE_ENV:"development",IAI_LOCAL_HTTP:"true",APP_BASE_URL:"http://localhost:5173"};
  assert.equal(runtimeHost(local),"127.0.0.1");
  assert.equal(runtimeHost({...local,APP_BASE_URL:"http://example.com"}),"0.0.0.0");
  assert.equal(runtimeHost({...local,NODE_ENV:"production"}),"0.0.0.0");
  assert.equal(runtimeHost({...local,IAI_LOCAL_HTTP:"false"}),"0.0.0.0");
});

test("configuração efetiva de API e Vite usa o bind local calculado", async () => {
  process.env.NODE_ENV="development";
  process.env.IAI_LOCAL_HTTP="true";
  process.env.APP_BASE_URL="http://localhost:5173";
  process.env.PORT="5173";
  process.env.BASE_PATH="/";
  delete process.env.REPL_ID;
  const [{serverHost},vite]=await Promise.all([
    import("../artifacts/api-server/src/lib/server-config.ts"),
    import("../artifacts/iai-web/vite.config.ts"),
  ]);
  assert.equal(serverHost(),"127.0.0.1");
  assert.equal(vite.default.server?.host,"127.0.0.1");
  assert.equal(vite.default.preview?.host,"127.0.0.1");
});

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

test("uso é observado antes de conteúdo inesperado ser recusado", async () => {
  process.env.DATABASE_URL = "postgresql://localhost:1/unused";
  process.env.PRIORIS_AI_PROVIDER = "anthropic";
  const { createModelProviders } = await import("../artifacts/api-server/src/routes/functional-orchestrator.ts");
  const usage={input_tokens:11,output_tokens:7};
  let observed: unknown=null;
  const providers=createModelProviders({
    client:{messages:{create:async()=>({stop_reason:"end_turn",usage,content:[{type:"thinking",thinking:"privado"},{type:"tool_use",name:"ferramenta_inesperada",input:{}}]})}} as never,
    onUsage:(_model,value)=>{observed=value;},
  });
  await assert.rejects(
    providers.classify({messages:[{role:"user",content:"Cenário fictício."}],history:[],previousAgent:null,functionalNeed:null}),
    /MISSING_CLASSIFICATION/,
  );
  assert.equal(observed,usage);
});

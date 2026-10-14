import {
  Router,
  type Request,
  type Response,
  type RequestHandler,
} from "express";
import * as oidc from "openid-client";
import Anthropic from "@anthropic-ai/sdk";
import { randomBytes, createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createPilotBudget } from "../lib/pilot-budget.cjs";
import { createPilotStore } from "../lib/pilot-store.cjs";
import { createPilotDelivery } from "../lib/pilot-delivery.cjs";
import { prepareFifthRound } from "../lib/pilot-rounds.cjs";
import { pilotIdentity, advanceBlock, advancePilotRound, abandonBlock, abandonPilotConversation } from "../lib/pilot-next-round.cjs";
import { ROUTING_VERSION } from "../lib/functional-policy.cjs";
import { REVISION as METHODOLOGY_REVISION } from "../lib/methodological-fidelity.cjs";
import {
  createFunctionalRouter,
  createModelProviders,
} from "./functional-orchestrator";
import type { AuthenticatedRequest } from "../middlewares/auth";

const BASE = "/api/pilot-0.3.0",
  COOKIE = "__Secure-iai-pilot-owner",
  FLOW = "__Secure-iai-pilot-flow";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function createPilotRouter(
  options: {
    oidcClient?: typeof oidc;
    stateFile?: string;
    client?: Anthropic;
    simulatedModel?: {classify:any;respond:any};
  } = {},
) {
  const router = Router();
  // No production route, storage, identity, or provider is initialized there.
  const domain = process.env.REPLIT_DEV_DOMAIN;
  if (process.env.NODE_ENV !== "development" || !domain) return router;
  const origin = "https://" + domain;
  const provider = process.env.PRIORIS_AI_PROVIDER ?? "replit";
  const configured =
    ["replit", "anthropic"].includes(provider) &&
    (provider === "replit"
      ? Boolean(
          process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY &&
            process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
        )
      : Boolean(process.env.ANTHROPIC_API_KEY));
  const ownerId = process.env.REPL_OWNER_ID;
  const authConfigured = Boolean(ownerId && process.env.REPL_ID);
  // Stable across restarts: neither budget nor the single conversation resets.
  const file =
    options.stateFile ??
    resolve(
      process.cwd(),
      process.cwd().endsWith("api-server")
        ? "../../generated-artifacts/pilot-campaign/state-v1.json"
        : "generated-artifacts/pilot-campaign/state-v1.json",
    );
  let state: any;
  try {
    state = JSON.parse(readFileSync(file, "utf8"));
    if (state.provider !== provider) throw Error("PILOT_STATE_MISMATCH");
    state = prepareFifthRound(state);
  } catch (err: any) {
    // Only injected test fixtures may initialize a new empty ledger. Losing the
    // real pilot file must never silently reset the accumulated expenditure.
    if (err.code !== "ENOENT" || !options.stateFile)
      return blockedRouter(router);
    state = {
      version: ROUTING_VERSION,
      round: 5,
      provider,
      createdAt: Date.now(),
      expiresAt: Date.now() + 2 * 60 * 60 * 1000,
      budget: { currentRound: 5 },
      requests: {},
      audit: [],
      archivedRounds: [],
    };
  }
  const save = () => { try {
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    const temp = file + ".tmp";
    writeFileSync(temp, JSON.stringify(state), { mode: 0o600 });
    const snapshotDirectory = dirname(file) + "/snapshots";
    mkdirSync(snapshotDirectory, { recursive: true, mode: 0o700 });
    const serialized = JSON.stringify(state);
    const snapshotFile = snapshotDirectory + "/" + hash(serialized) + ".json";
    try { writeFileSync(snapshotFile, serialized, { mode: 0o600, flag: "wx" }); } catch (snapshotError: any) { if (snapshotError.code !== "EEXIST") throw snapshotError; }
    // Canonical commit is last: a failed archive write cannot advance the round.
    renameSync(temp, file);
  } catch (error) {
    const failure = error instanceof Error ? error : new Error("STORAGE_UNAVAILABLE");
    (failure as any).code = "STORAGE_UNAVAILABLE";
    throw failure;
  }
  };
  save();
  const budget = createPilotBudget(state.budget, save);
  let delivery = createPilotDelivery(state, save);
  delivery.recoverRestart();
  let identity = pilotIdentity(state.round);
  let store = createPilotStore(state, save, identity);
  let scope = {
    userId: identity.id,
    organizationId: identity.organizationId,
  };
  const pending = new Map<
    string,
    { verifier: string; nonce: string; state: string; expires: number }
  >();
  const auth = options.oidcClient ?? oidc;
  let ownerSession: { digest: string; expires: number } | null = null;
  let config: oidc.Configuration | null = null;
  let sdk: Anthropic | null = null;
  let inFlight = 0;
  const active = () => Date.now() < state.expiresAt;
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "none" as const,
    path: BASE,
    maxAge: 2 * 60 * 60 * 1000,
  };
  const authenticated = (req: Request) =>
    active() &&
    ownerSession !== null &&
    ownerSession.expires > Date.now() &&
    typeof req.cookies?.[COOKIE] === "string" &&
    hash(req.cookies[COOKIE]) === ownerSession.digest;
  const sameOrigin: RequestHandler = (req, res, next) => {
    if (req.get("origin") !== origin) {
      res.status(403).json({ error: "Origem não autorizada para o piloto." });
      return;
    }
    next();
  };
  const authorize: RequestHandler = (req, res, next) => {
    if (!authenticated(req)) {
      res
        .status(401)
        .json({
          error:
            "Entre com a conta Replit do proprietário para acessar o piloto.",
        });
      return;
    }
    (req as AuthenticatedRequest).user = identity;
    next();
  };
  const availability = () =>
    !active()
      ? "Esta rodada expirou. Chamadas reais bloqueadas."
      : !authConfigured
        ? "Identidade do proprietário não disponível. Chamadas reais bloqueadas."
        : !configured
          ? "Provedor existente não configurado. Chamadas reais bloqueadas."
          : budget.snapshot().blocked
            ? (budget.snapshot().reason ??
              "Medição de consumo indisponível. Chamadas bloqueadas.")
            : null;
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  router.get("/status", (req, res) =>
    res.json({
      version: ROUTING_VERSION,
      methodologyRevision: METHODOLOGY_REVISION,
      round: state.round, authenticated: authenticated(req),
      available: availability() === null,
      error: availability(),
      provider,
      models: ["claude-haiku-4-5", "claude-sonnet-4-5"],
      budget: budget.snapshot(),
      identity: authenticated(req) ? identity : undefined,
      historyEnabled: false,
      singleConversation: true,
      nextConversation: authenticated(req) ? {
        allowed: advanceBlock(state, inFlight) === null,
        reason: advanceBlock(state, inFlight),
        sessionId: state.session?.id ?? null,
      } : undefined,
      abandonConversation: authenticated(req) ? {
        allowed: abandonBlock(state, inFlight) === null,
        reason: abandonBlock(state, inFlight),
        sessionId: state.session?.id ?? null,
      } : undefined,
      abandonment: authenticated(req) ? state.abandonment : undefined,
    }),
  );
  router.post("/login", sameOrigin, async (req, res) => {
    if (!active() || !authConfigured) {
      res
        .status(503)
        .send(
          "O piloto está bloqueado: identidade do proprietário ou prazo indisponível.",
        );
      return;
    }
    if (authenticated(req)) {
      res.redirect("/pilot-0.3.0");
      return;
    }
    if (ownerSession && ownerSession.expires > Date.now()) {
      res
        .status(409)
        .send("O piloto já está vinculado a outra sessão do proprietário.");
      return;
    }
    if (pending.size >= 10) pending.clear();
    try {
      config ??= await auth.discovery(
        new URL("https://replit.com/oidc"),
        process.env.REPL_ID!,
      );
      const key = randomBytes(32).toString("hex"),
        verifier = auth.randomPKCECodeVerifier(),
        nonce = auth.randomNonce(),
        oauthState = auth.randomState();
      pending.set(hash(key), {
        verifier,
        nonce,
        state: oauthState,
        expires: Date.now() + 5 * 60 * 1000,
      });
      const url = auth.buildAuthorizationUrl(config, {
        redirect_uri: origin + BASE + "/callback",
        scope: "openid",
        code_challenge: await auth.calculatePKCECodeChallenge(verifier),
        code_challenge_method: "S256",
        state: oauthState,
        nonce,
      });
      res.cookie(FLOW, key, {
        ...cookieOptions,
        sameSite: "lax",
        maxAge: 5 * 60 * 1000,
      });
      res.redirect(url.href);
    } catch {
      res
        .status(503)
        .send(
          "Não foi possível iniciar a autenticação Replit. Nenhuma chamada de IA foi feita.",
        );
    }
  });
  router.get("/callback", async (req, res) => {
    const key = req.cookies?.[FLOW],
      entry = typeof key === "string" ? pending.get(hash(key)) : undefined;
    if (typeof key === "string") pending.delete(hash(key));
    res.clearCookie(FLOW, cookieOptions);
    try {
      if (!active() || !entry || entry.expires < Date.now() || !config)
        throw Error("AUTH_DENIED");
      const tokens = await auth.authorizationCodeGrant(
        config,
        new URL(req.originalUrl, origin),
        {
          pkceCodeVerifier: entry.verifier,
          expectedState: entry.state,
          expectedNonce: entry.nonce,
          idTokenExpected: true,
        },
      );
      const claims = tokens.claims();
      if (
        !claims ||
        claims.sub !== ownerId ||
        (ownerSession && ownerSession.expires > Date.now())
      )
        throw Error("AUTH_DENIED");
      const sid = randomBytes(32).toString("hex");
      ownerSession = {
        digest: hash(sid),
        expires: Math.min(state.expiresAt, Date.now() + 2 * 60 * 60 * 1000),
      };
      res.cookie(COOKIE, sid, cookieOptions);
      res.redirect("/pilot-0.3.0");
    } catch {
      res
        .status(403)
        .send(
          "Acesso negado. Use a conta Replit do proprietário; se a autorização expirou, volte ao piloto.",
        );
    }
  });
  router.post("/logout", sameOrigin, authorize, (_req, res) => {
    ownerSession = null;
    res.clearCookie(COOKIE, cookieOptions);
    res.json({ ok: true });
  });
  router.post("/sessions", sameOrigin, authorize, (_req, res) => {
    try { res.json({...store.open(scope),...delivery.view()}); }
    catch { res.status(503).json({code:"STORAGE_UNAVAILABLE",error:"Não foi possível recuperar a sessão com segurança."}); }
  });
  router.get("/delivery", authorize, (_req,res) => {
    res.json({sessionId:state.session?.id,exchangeCount:state.session?.exchangeCount,status:state.session?.status,...delivery.view()});
  });
  router.post("/abandon-conversation", sameOrigin, authorize, (req, res) => {
    const messages: Record<string, string> = {
      ROUND_CHANGED: "A rodada mudou. Atualize a tela antes de continuar.",
      PILOT_EXPIRED: "O período autorizado expirou. Nada foi encerrado.",
      TURN_IN_PROGRESS: "Aguarde o envio em andamento terminar antes de encerrar.",
      SESSION_NOT_ACTIVE: "Esta conversa não está ativa.",
      INVALID_REASON: "Use um motivo de até 2.000 caracteres.",
    };
    try {
      const abandonment = abandonPilotConversation(state, {
        expectedRound: req.body?.round, sessionId: req.body?.sessionId,
        reason: req.body?.reason, inFlight,
      }, save);
      res.json({ round: state.round, abandonment });
    } catch (err) {
      const code = err instanceof Error ? err.message : "STORAGE_UNAVAILABLE";
      res.status(code === "INVALID_REASON" ? 400 : messages[code] ? 409 : 503).json({
        code: messages[code] ? code : "STORAGE_UNAVAILABLE",
        error: messages[code] ?? "Não foi possível registrar a desistência. Nenhum encerramento foi confirmado.",
      });
    }
  });
  router.post("/next-conversation", sameOrigin, authorize, (req, res) => {
    const messages: Record<string, string> = {
      ROUND_CHANGED: "A rodada mudou. Atualize a tela antes de continuar.",
      PILOT_EXPIRED: "O período autorizado expirou. Nenhuma rodada foi aberta.",
      TURN_IN_PROGRESS: "Aguarde o envio em andamento terminar.",
      BUDGET_PENDING: "Há bloqueio ou contabilização pendente no orçamento.",
      SESSION_NOT_CLOSED: "Encerre a conversa atual antes de abrir outra.",
    };
    try {
      const result = advancePilotRound(state, {
        expectedRound: req.body?.round, sessionId: req.body?.sessionId, inFlight,
      }, save);
      identity = pilotIdentity(state.round);
      scope = { userId: identity.id, organizationId: identity.organizationId };
      store = createPilotStore(state, save, identity);
      delivery = createPilotDelivery(state, save);
      functionalRouter = makeFunctionalRouter();
      res.json(result);
    } catch (err) {
      const code = err instanceof Error ? err.message : "STORAGE_UNAVAILABLE";
      res.status(messages[code] ? 409 : 503).json({
        code: messages[code] ? code : "STORAGE_UNAVAILABLE",
        error: messages[code] ?? "Não foi possível arquivar a conversa. Nenhuma nova rodada foi confirmada.",
      });
    }
  });
  // A lazy, budgeted SDK: startup, login and session creation do not call AI.
  const guardedClient = {
    messages: {
      create: async (payload: any) => {
        if (!availability() && !budget.snapshot().blocked) {
          return budget.call(payload, async (p) => {
            if (options.client) return options.client.messages.create(p);
            if (!sdk) {
              const apiKey =
                provider === "replit"
                  ? process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY!
                  : process.env.ANTHROPIC_API_KEY!;
              const baseURL =
                provider === "replit"
                  ? process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL
                  : undefined;
              sdk = new Anthropic({
                apiKey,
                ...(baseURL ? { baseURL } : {}),
                maxRetries: 0,
                timeout: 30000,
              });
            }
            return sdk.messages.create(p);
          });
        }
        throw Error("PILOT_UNAVAILABLE");
      },
    },
  };
  const model = options.stateFile && options.simulatedModel ? options.simulatedModel : createModelProviders({
    client: guardedClient as unknown as Anthropic,
    onGenerationObservation: (entry) =>
      store.repository.recordGenerationObservation(scope, entry),
    onValidationObservation: (entry) =>
      store.repository.recordValidation(scope, entry),
  });
  router.post("/session/message", sameOrigin, authorize, (req, res, next) => {
    // A replay retrieves state and never enters the model path, even when the
    // original call failed or the budget no longer allows another call.
    if ((state.delivery?.[req.body?.requestId] || state.requests?.[req.body?.requestId] || state.audit?.some((a:any)=>a.requestId===req.body?.requestId)) && req.body?.sessionId === state.session?.id) {
      try { delivery.begin(req.body,inFlight);res.json({recovered:true,...delivery.view()}); }
      catch (err) {res.status(409).json({code:(err as Error).message,error:"Identificador já usado com outro conteúdo."});}
      return;
    }
    const unavailable = availability();
    if (unavailable || budget.snapshot().blocked) {
      res
        .status(503)
        .json({
          error:
            unavailable ??
            "Medição de consumo indisponível. Chamadas bloqueadas.",
        });
      return;
    }
    if (!state.session || req.body?.sessionId !== state.session.id) {
      res
        .status(403)
        .json({
          error: "Somente a conversa fictícia desta rodada é permitida.",
        });
      return;
    }
    if (inFlight) {
      res.status(409).json({ code: "TURN_IN_PROGRESS", error: "Já existe uma mensagem em processamento." });
      return;
    }
    try { delivery.begin(req.body,inFlight); }
    catch(err) {res.status((err as any).code==="STORAGE_UNAVAILABLE"?503:409).json({code:(err as any).code??(err as Error).message,error:"O envio não foi iniciado. Consulte o estado registrado."});return;}
    inFlight += 1;
    // A disconnected browser must not unlock a still-running provider call.
    let released = false;
    const release = () => { if (!released) { released = true; inFlight -= 1; } };
    let failureCode = "STORAGE_UNAVAILABLE";
    const json = res.json.bind(res);
    res.json = ((body:any) => {
      failureCode = body?.code ?? "STORAGE_UNAVAILABLE";
      if(failureCode==="MODEL_UNAVAILABLE")body.error="A chamada terminou sem resposta disponível; a causa externa não foi comprovada. Uso incerto permanece reservado. Não reenvie automaticamente.";
      if(failureCode==="INVALID_MODEL_RESPONSE")body.error="A resposta foi recusada pela validação, não por indisponibilidade do serviço. Seu envio foi preservado.";
      return json(body);
    }) as typeof res.json;
    const end = res.end.bind(res);
    res.end = ((...args: any[]) => {
      try { delivery.finish(req.body.requestId,failureCode); }
      catch { failureCode="STORAGE_UNAVAILABLE"; }
      release();
      return (end as any)(...args);
    }) as typeof res.end;
    next();
  });
  function makeFunctionalRouter() {
    return createFunctionalRouter({
      repository: store.repository,
      authorize,
      origins: () => [origin],
      enabled: () => true,
      ...model,
    });
  }
  let functionalRouter = makeFunctionalRouter();
  router.use((req, res, next) => functionalRouter(req, res, next));
  return router;
}
function blockedRouter(router: ReturnType<typeof Router>) {
  router.use((_req, res) =>
    res
      .status(503)
      .json({
        error:
          "Estado isolado do piloto indisponível. Chamadas reais bloqueadas.",
        available: false,
        authenticated: false,
        version: ROUTING_VERSION,
      }),
  );
  return router;
}
export default createPilotRouter();

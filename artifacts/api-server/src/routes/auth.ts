import { Router, type IRouter } from "express";
import { RequestMagicLinkBody, VerifyMagicLinkQueryParams, VerifyMagicLinkResponse, GetMeResponse } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { authRepository, publicUser } from "../lib/auth-repository";
import { mailAvailable, sendAccessEmail } from "../lib/auth-mailer";
import { COOKIE_OPTIONS, SESSION_COOKIE, SESSION_TTL_MS, RequestLimiter, credentialMatches, digestToken, emptyAuthState, isSameOrigin, issueLogin, issueSession, newToken, parseAuthState, requestCredential, serializeAuthState } from "../lib/auth-state";
const router: IRouter = Router();
const limiter = new RequestLimiter();
const genericMessage = "Se o endereço estiver cadastrado, você receberá as instruções de acesso por e-mail.";
router.post("/auth/request", async (req, res): Promise<void> => {
  if (!isSameOrigin(req.headers)) { res.status(403).json({ error: "Solicitação de acesso não permitida." }); return; }
  const parsed = RequestMagicLinkBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Informe um e-mail válido." }); return; }
  const email = parsed.data.email.trim().toLowerCase();
  if (!mailAvailable()) { res.status(503).json({ error: "A entrada está temporariamente indisponível. Tente novamente mais tarde." }); return; }
  if (!limiter.take("email:" + digestToken(email), 3, 60000) || !limiter.take("ip:" + (req.ip ?? "unknown"), 30, 60000)) { res.status(429).json({ error: "Aguarde um minuto antes de solicitar outro acesso." }); return; }
  try {
    const row = await authRepository.byEmail(email);
    if (!row) { res.status(202).json({ message: genericMessage }); return; }
    const token = newToken();
    const before = parseAuthState(row.authToken) ?? emptyAuthState();
    const next = issueLogin(before, token);
    if (!await authRepository.swap(row.id, row.authToken, next)) { res.status(429).json({ error: "Aguarde um momento e solicite o acesso novamente." }); return; }
    try { await sendAccessEmail(row.email, token); }
    catch {
      await authRepository.swap(row.id, serializeAuthState(next), parseAuthState(row.authToken));
      req.log.error({ userId: row.id }, "Falha no envio do acesso; nenhuma entrega confirmada");
      res.status(503).json({ error: "Não foi possível enviar o acesso. Tente novamente mais tarde." }); return;
    }
    req.log.info({ userId: row.id }, "Acesso aceito pelo serviço de e-mail");
    res.status(202).json({ message: genericMessage });
  } catch { req.log.error("Falha no serviço de acesso"); res.status(503).json({ error: "A entrada está temporariamente indisponível. Tente novamente mais tarde." }); }
});
router.get("/auth/verify", (_req, res): void => { res.status(405).json({ error: "Use a confirmação de acesso do aplicativo." }); });
router.post("/auth/verify", async (req, res): Promise<void> => {
  if (!isSameOrigin(req.headers)) { res.status(403).json({ error: "Solicitação de acesso não permitida." }); return; }
  const parsed = VerifyMagicLinkQueryParams.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Código de acesso inválido." }); return; }
  try {
    const row = await authRepository.byCredential("pending", digestToken(parsed.data.token));
    const state = parseAuthState(row?.authToken);
    if (!row || !credentialMatches(state, "pending", parsed.data.token)) { res.status(401).json({ error: "O acesso venceu ou já foi utilizado. Solicite outro e-mail." }); return; }
    const sessionToken = newToken();
    if (!await authRepository.swap(row.id, row.authToken, issueSession(sessionToken))) { res.status(401).json({ error: "O acesso venceu ou já foi utilizado. Solicite outro e-mail." }); return; }
    res.cookie(SESSION_COOKIE, sessionToken, { ...COOKIE_OPTIONS, maxAge: SESSION_TTL_MS });
    res.setHeader("Cache-Control", "no-store");
    res.json(VerifyMagicLinkResponse.parse(publicUser(row)));
  } catch { req.log.error("Falha na confirmação de acesso"); res.status(503).json({ error: "Não foi possível confirmar o acesso. Tente novamente mais tarde." }); }
});
router.get("/auth/me", requireAuth, (req: AuthenticatedRequest, res): void => { res.setHeader("Cache-Control", "no-store"); res.json(GetMeResponse.parse(req.user)); });
router.post("/auth/logout", async (req, res): Promise<void> => {
  if (!isSameOrigin(req.headers)) { res.status(403).json({ error: "Solicitação não permitida." }); return; }
  try {
    const credential = requestCredential(req.headers, req.cookies);
    if (credential.token) {
      const row = await authRepository.byCredential("session", digestToken(credential.token));
      const state = parseAuthState(row?.authToken);
      if (row && state && credentialMatches(state, "session", credential.token)) {
        if (!await authRepository.swap(row.id, row.authToken, { ...state, session: null })) { res.status(503).json({ error: "Não foi possível encerrar a sessão. Tente novamente." }); return; }
      }
    }
    res.clearCookie(SESSION_COOKIE, COOKIE_OPTIONS); res.status(204).end();
  } catch { req.log.error("Falha ao encerrar sessão"); res.status(503).json({ error: "Não foi possível encerrar a sessão. Tente novamente." }); }
});
export default router;

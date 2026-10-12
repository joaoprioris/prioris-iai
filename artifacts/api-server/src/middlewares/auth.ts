import type { Request, Response, NextFunction } from "express";
import { authRepository, publicUser } from "../lib/auth-repository";
import { credentialMatches, digestToken, isSameOrigin, parseAuthState, requestCredential } from "../lib/auth-state";
export interface AuthenticatedRequest extends Request { user?: { id: string; email: string; role: string; organizationId: string; organizationName: string; }; }
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const credential = requestCredential(req.headers, req.cookies);
  if (!credential.token) { res.status(401).json({ error: "Entre novamente para continuar." }); return; }
  if (credential.cookie && !["GET", "HEAD", "OPTIONS"].includes(req.method) && !isSameOrigin(req.headers)) { res.status(403).json({ error: "Solicitação não permitida." }); return; }
  try {
    const row = await authRepository.byCredential("session", digestToken(credential.token));
    if (!row || !credentialMatches(parseAuthState(row.authToken), "session", credential.token)) { res.status(401).json({ error: "Sua sessão venceu. Entre novamente." }); return; }
    req.user = publicUser(row); next();
  } catch { res.status(503).json({ error: "Serviço temporariamente indisponível. Tente novamente." }); }
}

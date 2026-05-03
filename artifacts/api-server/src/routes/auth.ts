import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db, usersTable, organizationsTable } from "@workspace/db";
import {
  RequestMagicLinkBody,
  RequestMagicLinkResponse,
  VerifyMagicLinkQueryParams,
  VerifyMagicLinkResponse,
  GetMeResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/auth/request", async (req, res): Promise<void> => {
  const parsed = RequestMagicLinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (!user) {
    res.status(404).json({ error: "E-mail não encontrado." });
    return;
  }

  const token = randomBytes(32).toString("hex");

  await db
    .update(usersTable)
    .set({ authToken: token })
    .where(eq(usersTable.id, user.id));

  req.log.info({ userId: user.id }, "Magic link gerado");

  const response: { message: string; token?: string } = {
    message: "Link de acesso gerado com sucesso.",
  };

  if (process.env.NODE_ENV !== "production") {
    response.token = token;
  }

  res.json(RequestMagicLinkResponse.parse(response));
});

router.get("/auth/verify", async (req, res): Promise<void> => {
  const parsed = VerifyMagicLinkQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { token } = parsed.data;

  const [row] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      role: usersTable.role,
      organizationId: usersTable.organizationId,
      organizationName: organizationsTable.name,
    })
    .from(usersTable)
    .innerJoin(organizationsTable, eq(usersTable.organizationId, organizationsTable.id))
    .where(eq(usersTable.authToken, token));

  if (!row) {
    res.status(401).json({ error: "Token inválido ou expirado." });
    return;
  }

  req.log.info({ userId: row.id }, "Autenticação verificada");

  res.json(
    VerifyMagicLinkResponse.parse({
      id: row.id,
      email: row.email,
      role: row.role ?? "leader",
      organizationId: row.organizationId,
      organizationName: row.organizationName,
    }),
  );
});

router.get("/auth/me", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  res.json(GetMeResponse.parse(req.user));
});

export default router;

import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { timingSafeEqual } from "crypto";
import { db, usersTable, organizationsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const router: IRouter = Router();

// ── Admin token middleware ─────────────────────────────────────────────────

function requireAdminToken(req: Request, res: Response, next: () => void): void {
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken) {
    logger.error("ADMIN_TOKEN env var is not set — admin routes are disabled");
    res.status(503).json({ error: "Admin access not configured." });
    return;
  }

  const authHeader = req.headers.authorization ?? "";
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  const expectedBytes = Buffer.from(adminToken);
  const providedBytes = Buffer.from(provided);
  if (!provided || providedBytes.length !== expectedBytes.length || !timingSafeEqual(providedBytes, expectedBytes)) {
    res.status(401).json({ error: "Token de administrador inválido." });
    return;
  }

  next();
}

// ── POST /admin/users ──────────────────────────────────────────────────────

router.post(
  "/admin/users",
  requireAdminToken as unknown as Parameters<typeof router.post>[1],
  async (req: Request, res: Response): Promise<void> => {
    const { email: suppliedEmail, organization_id } = req.body ?? {};
    const email = typeof suppliedEmail === "string" ? suppliedEmail.trim().toLowerCase() : suppliedEmail;

    if (typeof email !== "string" || !EMAIL_RE.test(email)) {
      res.status(400).json({ error: "E-mail inválido." });
      return;
    }
    if (typeof organization_id !== "string" || !UUID_RE.test(organization_id)) {
      res.status(400).json({ error: "organization_id deve ser um UUID válido." });
      return;
    }

    // Verify the organisation exists
    const [org] = await db
      .select({ id: organizationsTable.id, name: organizationsTable.name })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, organization_id));

    if (!org) {
      res.status(404).json({ error: `Organização ${organization_id} não encontrada.` });
      return;
    }

    // Upsert user — create if new, or refresh token if already registered
    // CREDENTIAL_ISSUING_REMOVED: normal email login issues expiring hashed credentials.

    const [existing] = await db
      .select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, organizationId: usersTable.organizationId })
      .from(usersTable)
      .where(eq(usersTable.email, email));

    let userId: string;

    if (existing) {
      if (existing.organizationId !== organization_id) { res.status(409).json({ error: "Este e-mail já pertence a outra organização." }); return; }
      userId = existing.id;
      req.log.info({ userId }, "Admin: usuário já cadastrado; credencial preservada");
    } else {
      const [created] = await db
        .insert(usersTable)
        .values({ email, organizationId: organization_id, authToken: null, role: "leader" })
        .returning({ id: usersTable.id });

      userId = created.id;
      req.log.info({ userId }, "Admin: novo usuário criado");
    }

    res.status(existing ? 200 : 201).json({
      user: {
        id: userId,
        email,
        organizationId: organization_id,
        organizationName: org.name,
        isNew: !existing,
      },
      loginRequired: true,
    });
  },
);

export default router;

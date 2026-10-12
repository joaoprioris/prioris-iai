import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
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

  if (!provided || provided !== adminToken) {
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
    const { email, organization_id } = req.body ?? {};

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
    const token = randomBytes(32).toString("hex");

    const [existing] = await db
      .select({ id: usersTable.id, email: usersTable.email, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.email, email));

    let userId: string;

    if (existing) {
      await db
        .update(usersTable)
        .set({ authToken: token })
        .where(eq(usersTable.id, existing.id));

      userId = existing.id;
      req.log.info({ userId, email, orgId: organization_id }, "Admin: token renovado para usuário existente");
    } else {
      const [created] = await db
        .insert(usersTable)
        .values({ email, organizationId: organization_id, authToken: token, role: "leader" })
        .returning({ id: usersTable.id });

      userId = created.id;
      req.log.info({ userId, email, orgId: organization_id }, "Admin: novo usuário criado");
    }

    // Build the magic link using the public domain when available
    const domain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
    const baseUrl = domain ? `https://${domain}` : `${req.protocol}://${req.get("host")}`;
    const magicLink = `${baseUrl}/?token=${token}`;

    res.status(existing ? 200 : 201).json({
      user: {
        id: userId,
        email,
        organizationId: organization_id,
        organizationName: org.name,
        isNew: !existing,
      },
      token,
      magicLink,
    });
  },
);

export default router;

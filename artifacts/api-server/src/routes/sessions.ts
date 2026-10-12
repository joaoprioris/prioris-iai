import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, sessionsTable } from "@workspace/db";
import {
  CreateSessionBody,
  GetSessionParams,
  GetSessionResponse,
  ListSessionsResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/sessions", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const user = req.user!;

  const rows = await db
    .select()
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.userId, user.id),
        eq(sessionsTable.organizationId, user.organizationId),
      ),
    )
    .orderBy(sessionsTable.createdAt);

  res.json(ListSessionsResponse.parse(rows));
});

router.post("/sessions", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const user = req.user!;

  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [session] = await db
    .insert(sessionsTable)
    .values({
      userId: user.id,
      organizationId: user.organizationId,
      agentType: parsed.data.agentType,
      context: {},
      exchangeCount: 0,
      status: "active",
    })
    .returning();

  req.log.info({ sessionId: session.id, agentType: session.agentType }, "Sessão criada");

  res.status(201).json(GetSessionResponse.parse(session));
});

router.get("/sessions/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const user = req.user!;

  const params = GetSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.id, params.data.id),
        eq(sessionsTable.userId, user.id),
        eq(sessionsTable.organizationId, user.organizationId),
      ),
    );

  if (!session) {
    res.status(404).json({ error: "Sessão não encontrada." });
    return;
  }

  res.json(GetSessionResponse.parse(session));
});

export default router;

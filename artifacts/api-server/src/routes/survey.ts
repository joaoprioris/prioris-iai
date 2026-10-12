import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, surveyResponsesTable, sessionsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/survey/response", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const user = req.user!;
  const { questionId, answerValue, sessionId } = req.body;

  if (!questionId || !Number.isInteger(answerValue) || answerValue < 0 || answerValue > 4) {
    res.status(400).json({ error: "questionId e answerValue (0–4) são obrigatórios." });
    return;
  }

  // Verify the session belongs to both this user and this organization
  if (sessionId) {
    const [session] = await db
      .select({ id: sessionsTable.id })
      .from(sessionsTable)
      .where(and(eq(sessionsTable.id, sessionId), eq(sessionsTable.organizationId, user.organizationId), eq(sessionsTable.userId, user.id)))
      .limit(1);
    if (!session) {
      res.status(404).json({ error: "Sessão não encontrada." });
      return;
    }
  }

  await db.insert(surveyResponsesTable).values({
    organizationId: user.organizationId,
    questionId,
    sessionId: sessionId ?? null,
    answerValue,
  });

  res.json({ ok: true });
});

export default router;

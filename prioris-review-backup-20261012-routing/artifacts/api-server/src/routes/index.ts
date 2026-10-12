import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import sessionsRouter from "./sessions";
import orchestratorRouter from "./orchestrator";
import surveyRouter from "./survey";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(sessionsRouter);
router.use(orchestratorRouter);
router.use(surveyRouter);
router.use(adminRouter);

export default router;

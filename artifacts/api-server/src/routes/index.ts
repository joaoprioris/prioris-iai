import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import sessionsRouter from "./sessions";
import orchestratorRouter from "./orchestrator";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(sessionsRouter);
router.use(orchestratorRouter);

export default router;

import { Router } from "express";
import { isMockLlm } from "../config/env.js";
import { authRouter } from "./auth.js";
import { baselineRouter } from "./baseline.js";
import { conceptRouter } from "./concepts.js";
import { dashboardRouter } from "./dashboard.js";
import { goalRouter } from "./goals.js";
import { learnerRouter } from "./learner.js";
import { knowledgeRouter } from "./knowledge.js";
import { resourcesRouter } from "./resources.js";
import { planRouter } from "./plan.js";
import { recallRouter } from "./recalls.js";
import { studySessionRouter } from "./studySessions.js";
import { assessmentRouter } from "./assessments.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    mockLlm: isMockLlm(),
    service: "recallloop",
  });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/baseline", baselineRouter);
apiRouter.use("/goals", goalRouter);
apiRouter.use("/plan", planRouter);
apiRouter.use("/learner", learnerRouter);
apiRouter.use("/knowledge", knowledgeRouter);
apiRouter.use("/resources", resourcesRouter);
apiRouter.use("/study-sessions", studySessionRouter);
apiRouter.use("/recalls", recallRouter);
apiRouter.use("/assessments", assessmentRouter);
apiRouter.use("/concepts", conceptRouter);
apiRouter.use("/dashboard", dashboardRouter);

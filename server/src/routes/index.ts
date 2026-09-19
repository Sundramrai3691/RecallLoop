import { Router } from "express";
import { isMockLlm } from "../config/env.js";
import { conceptRouter } from "./concepts.js";
import { dashboardRouter } from "./dashboard.js";
import { recallRouter } from "./recalls.js";
import { studySessionRouter } from "./studySessions.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    mockLlm: isMockLlm(),
    service: "recallloop",
  });
});

apiRouter.use("/study-sessions", studySessionRouter);
apiRouter.use("/recalls", recallRouter);
apiRouter.use("/concepts", conceptRouter);
apiRouter.use("/dashboard", dashboardRouter);

import { Router } from "express";
import {
  completeStudySessionHandler,
  createStudySessionHandler,
  getStudySessionHandler,
} from "../controllers/studySessionController.js";
import { requireAuth } from "../lib/auth.js";
import { createProcessRateLimit } from "../middleware/boundedLimits.js";

export const studySessionRouter = Router();

studySessionRouter.use(requireAuth);

studySessionRouter.post("/", createProcessRateLimit({ limit: 30, windowMs: 15 * 60_000, scope: "study-session-create" }), createStudySessionHandler);
studySessionRouter.get("/:id", getStudySessionHandler);
studySessionRouter.post("/:id/complete", completeStudySessionHandler);

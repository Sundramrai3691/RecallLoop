import { Router } from "express";
import {
  getRecallHandler,
  listDueRecallsHandler,
  revealRecallHintHandler,
  submitRecallHandler,
} from "../controllers/recallController.js";
import { requireAuth } from "../lib/auth.js";
import { createProcessRateLimit } from "../middleware/boundedLimits.js";

export const recallRouter = Router();

recallRouter.use(requireAuth);

recallRouter.get("/due", listDueRecallsHandler);
recallRouter.get("/:id", getRecallHandler);
recallRouter.post("/:id/hints", revealRecallHintHandler);
recallRouter.post("/:id/submit", createProcessRateLimit({ limit: 60, windowMs: 15 * 60_000, scope: "recall-submit" }), submitRecallHandler);

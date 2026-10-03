import { Router } from "express";
import {
  getRecallHandler,
  listDueRecallsHandler,
  revealRecallHintHandler,
  submitRecallHandler,
} from "../controllers/recallController.js";
import { requireAuth } from "../lib/auth.js";

export const recallRouter = Router();

recallRouter.use(requireAuth);

recallRouter.get("/due", listDueRecallsHandler);
recallRouter.get("/:id", getRecallHandler);
recallRouter.post("/:id/hints", revealRecallHintHandler);
recallRouter.post("/:id/submit", submitRecallHandler);

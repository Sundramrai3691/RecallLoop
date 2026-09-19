import { Router } from "express";
import {
  getRecallHandler,
  listDueRecallsHandler,
  submitRecallHandler,
} from "../controllers/recallController.js";

export const recallRouter = Router();

recallRouter.get("/due", listDueRecallsHandler);
recallRouter.get("/:id", getRecallHandler);
recallRouter.post("/:id/submit", submitRecallHandler);

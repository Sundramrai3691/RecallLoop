import { Router } from "express";
import {
  getLearnerSummaryHandler,
  getWeakConceptsHandler,
  getWeakSkillsHandler,
} from "../controllers/learnerController.js";
import { requireAuth } from "../lib/auth.js";

export const learnerRouter = Router();

learnerRouter.use(requireAuth);
learnerRouter.get("/summary", getLearnerSummaryHandler);
learnerRouter.get("/weak-concepts", getWeakConceptsHandler);
learnerRouter.get("/weak-skills", getWeakSkillsHandler);

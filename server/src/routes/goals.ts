import { Router } from "express";
import {
  createGoalHandler,
  createSkillHandler,
  deleteGoalHandler,
  deleteSkillHandler,
  generateGoalPlanHandler,
  getGoalHandler,
  getGoalPlanHandler,
  listGoalsHandler,
  listSkillsHandler,
  updateGoalHandler,
  updateSkillHandler,
} from "../controllers/goalController.js";
import { requireAuth } from "../lib/auth.js";
import { getStartingPointHandler } from "../controllers/startingPointController.js";

export const goalRouter = Router();

goalRouter.use(requireAuth);
goalRouter.get("/:goalId/starting-point", getStartingPointHandler);
goalRouter.post("/", createGoalHandler);
goalRouter.get("/", listGoalsHandler);
goalRouter.get("/:id", getGoalHandler);
goalRouter.patch("/:id", updateGoalHandler);
goalRouter.delete("/:id", deleteGoalHandler);
goalRouter.post("/:goalId/skills", createSkillHandler);
goalRouter.get("/:goalId/skills", listSkillsHandler);
goalRouter.post("/:goalId/plan/generate", generateGoalPlanHandler);
goalRouter.get("/:goalId/plan", getGoalPlanHandler);
goalRouter.patch("/skills/:id", updateSkillHandler);
goalRouter.delete("/skills/:id", deleteSkillHandler);

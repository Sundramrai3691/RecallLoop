import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../lib/auth.js";
import {
  createGoal,
  createSkill,
  deleteGoal,
  deleteSkill,
  generateGoalPlan,
  getGoal,
  getGoalPlan,
  getTodayPlan,
  listGoals,
  listSkills,
  updateGoal,
  updateSkill,
} from "../services/goal/goalService.js";

export async function createGoalHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await createGoal(req.user!.id, req.body ?? {});
    res.status(201).json({ goal: result });
  } catch (error) {
    next(error);
  }
}

export async function listGoalsHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await listGoals(req.user!.id);
    res.json({ goals: result });
  } catch (error) {
    next(error);
  }
}

export async function getGoalHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await getGoal(req.user!.id, req.params.id);
    res.json({ goal: result });
  } catch (error) {
    next(error);
  }
}

export async function updateGoalHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await updateGoal(req.user!.id, req.params.id, req.body ?? {});
    res.json({ goal: result });
  } catch (error) {
    next(error);
  }
}

export async function deleteGoalHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await deleteGoal(req.user!.id, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function createSkillHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await createSkill(req.user!.id, req.params.goalId, req.body ?? {});
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listSkillsHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await listSkills(req.user!.id, req.params.goalId);
    res.json({ skills: result });
  } catch (error) {
    next(error);
  }
}

export async function updateSkillHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await updateSkill(req.user!.id, req.params.id, req.body ?? {});
    res.json({ skill: result });
  } catch (error) {
    next(error);
  }
}

export async function deleteSkillHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await deleteSkill(req.user!.id, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function generateGoalPlanHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await generateGoalPlan(req.user!.id, req.params.goalId);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getGoalPlanHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await getGoalPlan(req.user!.id, req.params.goalId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getTodayPlanHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await getTodayPlan(req.user!.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

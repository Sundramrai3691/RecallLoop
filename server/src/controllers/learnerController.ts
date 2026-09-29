import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../lib/auth.js";
import {
  getLearnerSummary,
  getWeakConcepts,
  getWeakSkills,
} from "../services/learner/learnerModelService.js";

export async function getLearnerSummaryHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const summary = await getLearnerSummary(req.user!.id);
    res.json(summary);
  } catch (error) {
    next(error);
  }
}

export async function getWeakConceptsHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const weakConcepts = await getWeakConcepts(req.user!.id, 10);
    res.json({ weakConcepts });
  } catch (error) {
    next(error);
  }
}

export async function getWeakSkillsHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const weakSkills = await getWeakSkills(req.user!.id);
    res.json({ weakSkills });
  } catch (error) {
    next(error);
  }
}

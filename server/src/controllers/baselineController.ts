import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../lib/auth.js";
import { createBaseline, getBaseline, submitBaselineQuestion } from "../services/baseline/baselineService.js";

export async function createBaselineHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    res.status(201).json({ baseline: await createBaseline({ userId: req.user!.id, ...req.body }) });
  } catch (error) { next(error); }
}

export async function getBaselineHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json({ baseline: await getBaseline(req.params.id, req.user!.id) }); } catch (error) { next(error); }
}

export async function submitBaselineHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json({ baseline: await submitBaselineQuestion(req.params.id, req.user!.id, req.body ?? {}) }); } catch (error) { next(error); }
}

export async function getBaselineResultHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json({ result: await getBaseline(req.params.id, req.user!.id) }); } catch (error) { next(error); }
}

import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../lib/auth.js";
import { getStartingPoint } from "../services/startingPoint/startingPointService.js";

export async function getStartingPointHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json(await getStartingPoint(req.user!.id, req.params.goalId)); } catch (error) { next(error); }
}

import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../lib/auth.js";
import { recommendResources } from "../services/resources/resourceRecommendationService.js";

export async function recommendResourcesHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const resources = await recommendResources({ userId: req.user!.id, conceptId: req.query.conceptId as string | undefined, availableMinutes: Number(req.query.availableMinutes ?? 60), limit: Number(req.query.limit ?? 4) });
    res.json({ resources });
  } catch (error) { next(error); }
}

import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../lib/auth.js";
import { recommendResources } from "../services/resources/resourceRecommendationService.js";
import { buildLearningPack } from "../services/resources/learningPackService.js";
import { AppError } from "../utils/errors.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function optionalUuid(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !UUID.test(value)) throw new AppError(`${field} must be a UUID`,400,"VALIDATION_ERROR");
  return value;
}

export async function recommendResourcesHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const availableMinutes=Number(req.query.availableMinutes??60);const limit=Number(req.query.limit??4);
    if(!Number.isInteger(availableMinutes)||availableMinutes<0||availableMinutes>240||!Number.isInteger(limit)||limit<1||limit>4)throw new AppError("availableMinutes must be 0–240 and limit 1–4",400,"VALIDATION_ERROR");
    const resources = await recommendResources({ userId: req.user!.id, conceptId: optionalUuid(req.query.conceptId,"conceptId"), goalId:optionalUuid(req.query.goalId,"goalId"),skillId:optionalUuid(req.query.skillId,"skillId"),availableMinutes, limit });
    res.json({ resources });
  } catch (error) { next(error); }
}

export async function learningPackHandler(req:AuthenticatedRequest,res:Response,next:NextFunction){try{const availableMinutes=Number(req.query.availableMinutes??60);if(!Number.isInteger(availableMinutes)||availableMinutes<0||availableMinutes>240)throw new AppError("availableMinutes must be an integer from 0 to 240",400,"VALIDATION_ERROR");const conceptId=optionalUuid(req.query.conceptId,"conceptId");if(!conceptId)throw new AppError("conceptId is required",400,"VALIDATION_ERROR");const pack=await buildLearningPack({userId:req.user!.id,conceptId,goalId:optionalUuid(req.query.goalId,"goalId"),availableMinutes});res.json({pack});}catch(error){next(error);}}

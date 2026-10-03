import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../lib/auth.js";
import { createAssessment, getAssessment } from "../services/question/assessmentService.js";
import { serializeAttempt } from "../lib/serialize.js";

export async function createAssessmentHandler(req: AuthenticatedRequest,res: Response,next: NextFunction): Promise<void> {
  try {
    const result = await createAssessment(req.user!.id,req.body?.conceptId,req.body?.mode);
    res.status(201).json({ assessment: result.assessment, questions: result.questions.map(serializeAttempt) });
  } catch (error) { next(error); }
}

export async function getAssessmentHandler(req: AuthenticatedRequest,res: Response,next: NextFunction): Promise<void> {
  try {
    const result = await getAssessment(req.user!.id,req.params.id);
    res.json({ assessment: result.assessment, questions: result.questions.map(serializeAttempt), result: result.result });
  } catch (error) { next(error); }
}

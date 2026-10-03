import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../lib/auth.js";
import { getConceptById, listConcepts } from "../services/concept/conceptService.js";
import { getReview } from "../repositories/legacyPostgresRepositories.js";
import { notFound } from "../utils/errors.js";
import { getConceptState } from "../services/learner/learnerModelService.js";
import { serializeConcept, serializeReview } from "../lib/serialize.js";
import { confirmReviewDate } from "../services/recall/recallService.js";
import { AppError } from "../utils/errors.js";

export async function listConceptsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const concepts = await listConcepts(req.user!.id);
    res.json({ concepts: concepts.map(serializeConcept) });
  } catch (err) {
    next(err);
  }
}

export async function getConceptHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const concept = await getConceptById(req.params.id, req.user!.id);
    if (!concept) throw notFound("Concept not found", "MISSING_CONCEPT");
    const review = await getReview(req.user!.id, concept.id);
    const learnerState = await getConceptState(req.user!.id, concept.id);
    res.json({
      concept: serializeConcept(concept),
      review: serializeReview(review),
      dimensionScores: learnerState?.dimensionScores ?? {},
      learnerState,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateConceptReviewHandler(req: AuthenticatedRequest,res: Response,next: NextFunction): Promise<void> {
  try {
    if (typeof req.body?.dueAt !== "string") throw new AppError("dueAt is required",400,"VALIDATION_ERROR");
    res.json({ review: serializeReview(await confirmReviewDate(req.user!.id,req.params.id,req.body.dueAt)) });
  } catch (err) { next(err); }
}

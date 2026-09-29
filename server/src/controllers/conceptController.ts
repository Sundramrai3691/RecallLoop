import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../lib/auth.js";
import { ReviewState } from "../models/ReviewState.js";
import { getConceptById, listConcepts } from "../services/concept/conceptService.js";
import { notFound } from "../utils/errors.js";
import { serializeConcept, serializeReview } from "../lib/serialize.js";

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
    const review = await ReviewState.findOne({ conceptId: concept._id, userId: req.user!.id });
    res.json({
      concept: serializeConcept(concept),
      review: serializeReview(review),
    });
  } catch (err) {
    next(err);
  }
}

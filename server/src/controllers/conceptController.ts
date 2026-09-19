import type { NextFunction, Request, Response } from "express";
import { ReviewState } from "../models/ReviewState.js";
import { getConceptById, listConcepts } from "../services/concept/conceptService.js";
import { notFound } from "../utils/errors.js";
import { serializeConcept, serializeReview } from "../lib/serialize.js";

export async function listConceptsHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const concepts = await listConcepts();
    res.json({ concepts: concepts.map(serializeConcept) });
  } catch (err) {
    next(err);
  }
}

export async function getConceptHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const concept = await getConceptById(req.params.id);
    if (!concept) throw notFound("Concept not found", "MISSING_CONCEPT");
    const review = await ReviewState.findOne({ conceptId: concept._id });
    res.json({
      concept: serializeConcept(concept),
      review: serializeReview(review),
    });
  } catch (err) {
    next(err);
  }
}

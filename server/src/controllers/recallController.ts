import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../lib/auth.js";
import {
  getRecall,
  listDueRecalls,
  submitRecall,
} from "../services/recall/recallService.js";
import {
  serializeAttempt,
  serializeConcept,
  serializeReview,
} from "../lib/serialize.js";

export async function listDueRecallsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const due = await listDueRecalls(req.user!.id);
    res.json({
      recalls: due.map((row) => ({
        ...serializeAttempt(row.attempt),
        concept: row.concept ? serializeConcept(row.concept) : null,
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function getRecallHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { attempt, concept } = await getRecall(req.params.id, req.user!.id);
    res.json({
      recall: serializeAttempt(attempt),
      concept: {
        id: String(concept._id),
        name: concept.name,
        studySessionId: String(concept.studySessionId),
        mastery: concept.mastery,
        difficulty: concept.difficulty,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function submitRecallHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { attempt, concept, review } = await submitRecall(req.params.id, {
      answer: req.body?.answer,
      confidence: req.body?.confidence,
      userId: req.user?.id,
    });
    res.json({
      recall: serializeAttempt(attempt),
      concept: serializeConcept(concept),
      review: serializeReview(review),
    });
  } catch (err) {
    next(err);
  }
}

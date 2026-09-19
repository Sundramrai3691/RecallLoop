import type { NextFunction, Request, Response } from "express";
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
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const due = await listDueRecalls();
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
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { attempt, concept } = await getRecall(req.params.id);
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
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { attempt, concept, review } = await submitRecall(req.params.id, {
      answer: req.body?.answer,
      confidence: req.body?.confidence,
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

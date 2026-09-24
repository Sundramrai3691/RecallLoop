import type { NextFunction, Request, Response } from "express";
import {
  completeStudySession,
  createStudySession,
  getStudySession,
} from "../services/study/studySessionService.js";
import { serializeAttempt, serializeConcept, serializeSession } from "../lib/serialize.js";

export async function createStudySessionHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { session, concepts } = await createStudySession(req.body ?? {});
    res.status(201).json({
      session: serializeSession(session),
      concepts: concepts.map(serializeConcept),
    });
  } catch (err) {
    next(err);
  }
}

export async function getStudySessionHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { session, concepts, pendingRecalls } = await getStudySession(req.params.id);
    res.json({
      session: serializeSession(session),
      concepts: concepts.map(serializeConcept),
      pendingRecalls: pendingRecalls.map(serializeAttempt),
    });
  } catch (err) {
    next(err);
  }
}

export async function completeStudySessionHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { session, concepts, recalls } = await completeStudySession(req.params.id);
    res.json({
      session: serializeSession(session),
      concepts: concepts.map(serializeConcept),
      recalls: recalls.map(serializeAttempt),
    });
  } catch (err) {
    next(err);
  }
}

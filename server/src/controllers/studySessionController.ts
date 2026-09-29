import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../lib/auth.js";
import {
  completeStudySession,
  createStudySession,
  getStudySession,
} from "../services/study/studySessionService.js";
import { serializeAttempt, serializeConcept, serializeSession } from "../lib/serialize.js";

export async function createStudySessionHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { session, concepts } = await createStudySession({
      ...(req.body ?? {}),
      userId: req.user?.id,
    });
    res.status(201).json({
      session: serializeSession(session),
      concepts: concepts.map(serializeConcept),
    });
  } catch (err) {
    next(err);
  }
}

export async function getStudySessionHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { session, concepts, pendingRecalls } = await getStudySession(req.params.id, req.user?.id);
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
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { session, concepts, recalls } = await completeStudySession(req.params.id, req.user?.id);
    res.json({
      session: serializeSession(session),
      concepts: concepts.map(serializeConcept),
      recalls: recalls.map(serializeAttempt),
    });
  } catch (err) {
    next(err);
  }
}

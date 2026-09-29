import { DEFAULT_USER_ID } from "../../config/env.js";
import { StudySession, type SourceType } from "../../models/StudySession.js";
import { AppError, notFound } from "../../utils/errors.js";
import { createConceptsForSession, listConceptsForSession } from "../concept/conceptService.js";
import { RecallAttempt } from "../../models/RecallAttempt.js";
import { createImmediateRecalls } from "../recall/recallService.js";
import { recordLearningEvent } from "../events/learningEventService.js";

const SOURCE_TYPES: SourceType[] = ["manual", "notes", "url", "file"];

export async function createStudySession(input: {
  title: string;
  rawMaterial?: string;
  sourceType?: string;
  userId?: string;
}) {
  const title = input.title?.trim();
  if (!title) {
    throw new AppError("A topic/title is required", 400, "VALIDATION_ERROR");
  }
  const sourceType = (input.sourceType as SourceType | undefined) ?? (input.rawMaterial ? "notes" : "manual");
  if (!SOURCE_TYPES.includes(sourceType)) {
    throw new AppError("Invalid sourceType", 400, "VALIDATION_ERROR");
  }

  const userId = input.userId ?? DEFAULT_USER_ID;
  const session = await StudySession.create({
    userId,
    title,
    rawMaterial: input.rawMaterial?.trim() ?? "",
    sourceType,
    status: "in_progress",
    startedAt: new Date(),
  });

  const concepts = await createConceptsForSession({
    studySessionId: String(session._id),
    title: session.title,
    rawMaterial: session.rawMaterial,
    userId,
  });

  await recordLearningEvent({
    userId,
    type: "STUDY_STARTED",
    entityType: "StudySession",
    entityId: session._id,
    payload: { title: session.title },
  });

  return { session, concepts };
}

export async function getStudySession(id: string, userId?: string) {
  const session = await StudySession.findById(id);
  if (!session) throw notFound("Study session not found", "STUDY_SESSION_NOT_FOUND");
  if (userId && session.userId !== userId) {
    throw new AppError("You do not have access to this resource", 403, "FORBIDDEN");
  }
  const concepts = await listConceptsForSession(id, userId);
  const pendingRecalls = await RecallAttempt.find({
    studySessionId: session._id,
    userId: userId ?? session.userId ?? "local-user",
    submittedAt: { $exists: false },
  }).sort({ createdAt: 1 });
  return { session, concepts, pendingRecalls };
}

export async function completeStudySession(id: string, userId?: string) {
  const session = await StudySession.findById(id);
  if (!session) throw notFound("Study session not found", "STUDY_SESSION_NOT_FOUND");

  if (userId && session.userId !== userId) {
    throw new AppError("You do not have access to this resource", 403, "FORBIDDEN");
  }

  let concepts = await listConceptsForSession(id, userId ?? session.userId);
  if (concepts.length === 0) {
    concepts = await createConceptsForSession({
      studySessionId: id,
      title: session.title,
      rawMaterial: session.rawMaterial,
      userId: userId ?? session.userId,
    });
  }

  if (session.status === "completed") {
    const recalls = await createImmediateRecalls({
      studySessionId: id,
      concepts,
      userId: userId ?? session.userId,
    });
    return { session, concepts, recalls, alreadyCompleted: true };
  }

  session.status = "completed";
  session.completedAt = new Date();
  await session.save();

  await recordLearningEvent({
    userId: userId ?? session.userId ?? "local-user",
    type: "STUDY_COMPLETED",
    entityType: "StudySession",
    entityId: session._id,
    payload: { conceptCount: concepts.length },
  });

  const recalls = await createImmediateRecalls({
    studySessionId: id,
    concepts,
    userId: userId ?? session.userId,
  });

  return { session, concepts, recalls, alreadyCompleted: false };
}

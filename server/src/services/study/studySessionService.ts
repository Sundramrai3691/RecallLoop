import { AppError, notFound } from "../../utils/errors.js";
import { createSession, getSession, completeSession, listConceptsForSession, createConcepts, listPending, createAttempt, createInitialReview } from "../../repositories/legacyPostgresRepositories.js";
import { createConceptsForSession } from "../concept/conceptService.js";
import { buildRecallQuestion } from "../question/questionService.js";
import { recordLearningEvent } from "../events/learningEventService.js";

const SOURCE_TYPES = ["manual", "notes", "url", "file"];

export async function createStudySession(input: { title: string; rawMaterial?: string; sourceType?: string; userId: string }) {
  const title = input.title?.trim();
  if (!title) throw new AppError("A topic/title is required", 400, "VALIDATION_ERROR");
  const sourceType = input.sourceType ?? (input.rawMaterial ? "notes" : "manual");
  if (!SOURCE_TYPES.includes(sourceType)) throw new AppError("Invalid sourceType", 400, "VALIDATION_ERROR");
  const session = await createSession(input.userId, { ...input, title, sourceType });
  const concepts = await createConceptsForSession({ studySessionId: session.id, title, rawMaterial: input.rawMaterial, userId: input.userId });
  await recordLearningEvent({ userId: input.userId, type: "STUDY_STARTED", entityType: "StudySession", entityId: session.id, payload: { title } });
  return { session, concepts };
}

export async function getStudySession(id: string, userId: string) {
  const session = await getSession(id, userId);
  if (!session) throw notFound("Study session not found", "STUDY_SESSION_NOT_FOUND");
  return { session, concepts: await listConceptsForSession(id, userId), pendingRecalls: await listPending(id, userId) };
}

export async function completeStudySession(id: string, userId: string) {
  const existing = await getSession(id, userId);
  if (!existing) throw notFound("Study session not found", "STUDY_SESSION_NOT_FOUND");
  let concepts = await listConceptsForSession(id, userId);
  if (!concepts.length) concepts = await createConceptsForSession({ studySessionId: id, title: existing.title, rawMaterial: existing.rawMaterial, userId });
  const session = existing.status === "completed" ? existing : completeSession(id, userId);
  const completed = await session;
  if (!completed) throw notFound("Study session not found", "STUDY_SESSION_NOT_FOUND");
  const recalls = [];
  for (const concept of concepts) {
    const attempt = await createAttempt(userId, id, concept, "explain", buildRecallQuestion(concept.name, "explain"));
    if (attempt) recalls.push(attempt);
    await createInitialReview(userId, concept.id, concept.difficulty);
  }
  await recordLearningEvent({ userId, type: "STUDY_COMPLETED", entityType: "StudySession", entityId: id, payload: { conceptCount: concepts.length } });
  return { session: completed, concepts, recalls };
}

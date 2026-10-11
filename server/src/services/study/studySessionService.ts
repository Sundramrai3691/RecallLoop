import { AppError, notFound } from "../../utils/errors.js";
import { createSession, getSession, listConceptsForSession, listPending } from "../../repositories/legacyPostgresRepositories.js";
import { completeStudyWrites } from "../../repositories/postgresRepositories.js";
import { createConceptsForSession, persistPreparedConcepts, prepareConcepts } from "../concept/conceptService.js";
import { recordLearningEvent } from "../events/learningEventService.js";

const SOURCE_TYPES = ["manual", "notes", "url", "file"];

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function looksLikeUrlOnlyMaterial(value: string): boolean {
  const trimmed = value.trim();
  return Boolean(trimmed && isHttpUrl(trimmed));
}

export function validateStudySessionInput(input: { title: string; rawMaterial?: string; sourceUrl?: string }) {
  const title = input.title?.trim();
  if (!title) throw new AppError("A topic/title is required", 400, "VALIDATION_ERROR");
  if (isHttpUrl(title) || /^www\./i.test(title)) throw new AppError("Enter a topic name here, not a URL. Add the link under Source link and paste usable notes or text below.", 400, "TOPIC_URL_NOT_ALLOWED");
  const sourceUrl = input.sourceUrl?.trim() || null;
  if (sourceUrl && !isHttpUrl(sourceUrl)) throw new AppError("Enter a valid http(s) source link.", 400, "INVALID_SOURCE_URL");
  const rawMaterial = input.rawMaterial?.trim() ?? "";
  if (!rawMaterial || looksLikeUrlOnlyMaterial(rawMaterial)) throw new AppError("Add notes or source text to extract concepts. A link is saved as provenance; RecallLoop does not fetch webpage or video contents.", 400, "STUDY_TEXT_REQUIRED");
  return { title, sourceUrl, rawMaterial };
}

export async function createStudySession(input: { title: string; rawMaterial?: string; sourceType?: string; sourceUrl?: string; userId: string }) {
  const { title, sourceUrl, rawMaterial } = validateStudySessionInput(input);
  const sourceType = input.sourceType ?? (input.rawMaterial ? "notes" : "manual");
  if (!SOURCE_TYPES.includes(sourceType)) throw new AppError("Invalid sourceType", 400, "VALIDATION_ERROR");
  const preparedConcepts = await prepareConcepts({ title, rawMaterial });
  const session = await createSession(input.userId, { ...input, title, rawMaterial, sourceUrl, sourceType });
  const concepts = await persistPreparedConcepts({ studySessionId: session.id, concepts: preparedConcepts, userId: input.userId });
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
  const written = await completeStudyWrites(userId, id, concepts);
  if (!written) throw notFound("Study session not found", "STUDY_SESSION_NOT_FOUND");
  const recalls = [];
  for (const attemptId of written.attempts) {
    const pending = await listPending(id, userId);
    const attempt = pending.find((item: any) => item.id === attemptId);
    if (attempt) recalls.push(attempt);
  }
  return { session: written.session, concepts, recalls };
}

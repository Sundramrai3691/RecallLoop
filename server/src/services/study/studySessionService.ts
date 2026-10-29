import { AppError, notFound } from "../../utils/errors.js";
import { createSession, getSession, listConceptsForSession, listPending } from "../../repositories/legacyPostgresRepositories.js";
import { completeStudyWrites } from "../../repositories/postgresRepositories.js";
import { createConceptsForSession, persistPreparedConcepts, prepareConcepts } from "../concept/conceptService.js";
import { recordLearningEvent } from "../events/learningEventService.js";
import { query } from "../../db/postgres.js";
import { findSource } from "../../repositories/groundingRepository.js";

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

export function validateStudySessionInput(input: { title: string; rawMaterial?: string; sourceUrl?: string; canonicalTopicId?: string; canonicalConceptId?: string; groundingSourceId?: string }) {
  const title = input.title?.trim();
  if (!title) throw new AppError("A topic/title is required", 400, "VALIDATION_ERROR");
  if (isHttpUrl(title) || /^www\./i.test(title)) throw new AppError("Enter a topic name here, not a URL. Add the link under Source link and paste usable notes or text below.", 400, "TOPIC_URL_NOT_ALLOWED");
  const sourceUrl = input.sourceUrl?.trim() || null;
  if (sourceUrl && !isHttpUrl(sourceUrl)) throw new AppError("Enter a valid http(s) source link.", 400, "INVALID_SOURCE_URL");
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (input.canonicalTopicId && !uuidPattern.test(input.canonicalTopicId.trim())) throw new AppError("The selected canonical topic ID is invalid.", 400, "INVALID_CANONICAL_RELATIONSHIP");
  if (input.canonicalConceptId && !uuidPattern.test(input.canonicalConceptId.trim())) throw new AppError("The selected canonical concept ID is invalid.", 400, "INVALID_CANONICAL_RELATIONSHIP");
  if (input.canonicalConceptId && !input.canonicalTopicId) throw new AppError("A canonical concept must include its parent topic.", 400, "INVALID_CANONICAL_RELATIONSHIP");
  if (input.groundingSourceId && !uuidPattern.test(input.groundingSourceId.trim())) throw new AppError("The selected learning source ID is invalid.", 400, "INVALID_GROUNDING_SOURCE");
  const rawMaterial = input.rawMaterial?.trim() ?? "";
  if (!rawMaterial || looksLikeUrlOnlyMaterial(rawMaterial)) throw new AppError("Add notes or source text to extract concepts. A link is saved as provenance; RecallLoop does not fetch webpage or video contents.", 400, "STUDY_TEXT_REQUIRED");
  return { title, sourceUrl, rawMaterial, canonicalTopicId: input.canonicalTopicId?.trim() || null, canonicalConceptId: input.canonicalConceptId?.trim() || null };
}

export async function createStudySession(input: { title: string; rawMaterial?: string; sourceType?: string; sourceUrl?: string; canonicalTopicId?: string; canonicalConceptId?: string; groundingSourceId?: string; userId: string }) {
  let groundedSource: Awaited<ReturnType<typeof findSource>> = null;
  if (input.groundingSourceId) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.groundingSourceId)) {
      throw new AppError("The selected learning source ID is invalid.", 400, "INVALID_GROUNDING_SOURCE");
    }
    groundedSource = await findSource(input.userId, input.groundingSourceId);
    if (!groundedSource) throw notFound("Learning material not found", "SOURCE_NOT_FOUND");
    if (groundedSource.processingStatus !== "processed" || !groundedSource.content.trim()) {
      throw new AppError("This material has no processed text to study yet.", 409, "SOURCE_NOT_READY");
    }
    const sourceType = groundedSource.sourceType === "web_article" ? "url" : ["pdf", "docx"].includes(groundedSource.sourceType) ? "file" : "notes";
    input = {
      ...input,
      title: input.title?.trim() || groundedSource.title,
      rawMaterial: groundedSource.content,
      sourceType,
      sourceUrl: isHttpUrl(groundedSource.reference) ? groundedSource.reference : undefined,
    };
  }
  const { title, sourceUrl, rawMaterial, canonicalTopicId, canonicalConceptId } = validateStudySessionInput(input);
  if (canonicalTopicId) {
    const validNode = await query(`SELECT t.id FROM topics t LEFT JOIN canonical_concepts c ON c.topic_id=t.id AND c.id=$2 WHERE t.id=$1 AND ($2::uuid IS NULL OR c.id IS NOT NULL) AND (($2::uuid IS NULL AND lower(trim(t.name))=lower(trim($3))) OR ($2::uuid IS NOT NULL AND lower(trim(c.name))=lower(trim($3))))`, [canonicalTopicId, canonicalConceptId,title]);
    if (!validNode.rows[0]) throw new AppError("The selected canonical topic or concept is unavailable or does not belong to that topic.", 404, "CANONICAL_NODE_NOT_FOUND");
  }
  const sourceType = input.sourceType ?? (input.rawMaterial ? "notes" : "manual");
  if (!SOURCE_TYPES.includes(sourceType)) throw new AppError("Invalid sourceType", 400, "VALIDATION_ERROR");
  const preparedConcepts = await prepareConcepts({ title, rawMaterial });
  const sourceType = input.sourceType ?? (input.rawMaterial ? "notes" : "manual");
  if (!SOURCE_TYPES.includes(sourceType)) throw new AppError("Invalid sourceType", 400, "VALIDATION_ERROR");
  const session = await createSession(input.userId, { ...input, title, rawMaterial, sourceUrl, canonicalTopicId, canonicalConceptId, sourceType, groundingSourceId: groundedSource?.id ?? null });
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

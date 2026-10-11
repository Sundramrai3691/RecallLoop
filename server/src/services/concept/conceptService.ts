import { AppError } from "../../utils/errors.js";
import { getEvaluator } from "../evaluator/index.js";
import { extractedConceptSchema } from "../evaluator/schemas.js";
import { createConcepts, getConcept, listConceptsForSession, mapConcept, updateConceptMastery } from "../../repositories/legacyPostgresRepositories.js";

export async function prepareConcepts(input: { title: string; rawMaterial?: string }) {
  if (!input.rawMaterial?.trim()) throw new AppError("Study notes or source text are required before concepts can be extracted", 400, "STUDY_TEXT_REQUIRED");
  const sourceText = input.rawMaterial.replace(/(?:https?:\/\/|www\.)\S+/gi, " ").trim();
  if (!sourceText) throw new AppError("Add notes or source text; a link alone is not extractable content.", 400, "STUDY_TEXT_REQUIRED");
  const extracted = await getEvaluator().extractConcepts({ title: input.title, rawMaterial: sourceText });
  if (extracted.some((concept) => /^https?:\/\/|^www\./i.test(concept.name.trim()))) throw new AppError("Concept extraction returned a URL as a topic. Add usable source text and try again.", 502, "INVALID_EXTRACTED_TOPIC");
  const validated = extracted.map((concept, index) => { const parsed = extractedConceptSchema.safeParse(concept); if (!parsed.success) throw new AppError(`Extracted concept ${index + 1} failed validation and was not stored`, 502, "INVALID_AI_JSON"); return parsed.data; });
  if (!validated.length) throw new AppError("No valid concepts were extracted", 502, "INVALID_AI_JSON");
  const merged = new Map<string, typeof validated[number]>();
  for (const concept of validated) {
    const name = concept.name.trim().replace(/\s+/g, " ");
    const key = name.toLowerCase();
    const points = [...new Map(concept.requiredKnowledgePoints.map((point) => {
      const normalized = point.trim().replace(/\s+/g, " ");
      return [normalized.toLowerCase(), normalized] as const;
    })).values()];
    const prior = merged.get(key);
    if (prior) {
      prior.requiredKnowledgePoints = [...new Map([...prior.requiredKnowledgePoints, ...points].map((point) => [point.toLowerCase(), point])).values()];
      if (concept.description.length > prior.description.length) prior.description = concept.description;
    } else merged.set(key, { ...concept, name, requiredKnowledgePoints: points });
  }
  return [...merged.values()];
}

export async function persistPreparedConcepts(input: { studySessionId: string; concepts: Awaited<ReturnType<typeof prepareConcepts>>; userId: string }) {
  return createConcepts(input.userId, input.studySessionId, input.concepts);
}

export async function createConceptsForSession(input: { studySessionId: string; title: string; rawMaterial?: string; userId: string }) {
  const concepts = await prepareConcepts(input);
  return persistPreparedConcepts({ studySessionId: input.studySessionId, concepts, userId: input.userId });
}
export async function listConceptsForSessionOwned(studySessionId: string, userId: string) { return listConceptsForSession(studySessionId, userId); }
export async function getConceptById(id: string, userId: string) { return getConcept(id, userId); }
export async function listConcepts(userId: string) { return (await import("../../db/postgres.js")).query(`SELECT * FROM personal_concepts WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 200`, [userId]).then((result) => result.rows.map(mapConcept)); }
export async function updateConceptMasteryForUser(conceptId: string, coverage: number, userId: string) { return updateConceptMastery(conceptId, userId, coverage); }

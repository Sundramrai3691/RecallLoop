import { AppError } from "../../utils/errors.js";
import { getEvaluator } from "../evaluator/index.js";
import { extractedConceptSchema } from "../evaluator/schemas.js";
import { createConcepts, getConcept, listConceptsForSession, mapConcept, updateConceptMastery } from "../../repositories/legacyPostgresRepositories.js";

export async function createConceptsForSession(input: { studySessionId: string; title: string; rawMaterial?: string; userId: string }) {
  const extracted = await getEvaluator().extractConcepts({ title: input.title, rawMaterial: input.rawMaterial });
  const validated = extracted.map((concept, index) => { const parsed = extractedConceptSchema.safeParse(concept); if (!parsed.success) throw new AppError(`Extracted concept ${index + 1} failed validation and was not stored`, 502, "INVALID_AI_JSON"); return parsed.data; });
  if (!validated.length) throw new AppError("No valid concepts were extracted", 502, "INVALID_AI_JSON");
  return createConcepts(input.userId, input.studySessionId, validated);
}
export async function listConceptsForSessionOwned(studySessionId: string, userId: string) { return listConceptsForSession(studySessionId, userId); }
export async function getConceptById(id: string, userId: string) { return getConcept(id, userId); }
export async function listConcepts(userId: string) { return (await import("../../db/postgres.js")).query(`SELECT * FROM personal_concepts WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 200`, [userId]).then((result) => result.rows.map(mapConcept)); }
export async function updateConceptMasteryForUser(conceptId: string, coverage: number, userId: string) { return updateConceptMastery(conceptId, userId, coverage); }

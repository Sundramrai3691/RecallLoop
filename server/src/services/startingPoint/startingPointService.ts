import { query } from "../../db/postgres.js";
import { recommendResources } from "../resources/resourceRecommendationService.js";

export async function getStartingPoint(userId: string, goalId: string) {
  const latest = await query(`
    SELECT ba.id, ba.selected_level AS "selectedLevel", ba.baseline_source AS "baselineSource", ba.baseline_confidence AS "baselineConfidence",
      ba.observed_mastery AS "observedMastery", ba.self_declared_mastery AS "selfDeclaredMastery", ba.recommended_concept_id AS "recommendedConceptId",
      c.name AS "recommendedConceptName"
    FROM baseline_assessments ba LEFT JOIN canonical_concepts c ON c.id = ba.recommended_concept_id
    WHERE ba.user_id = $1 AND ba.goal_id = $2 ORDER BY ba.created_at DESC LIMIT 1
  `, [userId, goalId]);
  const assessment = latest.rows[0] ?? null;
  if (!assessment) return { assessment: null, startingConcept: null, conceptsToSkip: [], conceptsToReview: [], resources: [] };
  const states = await query(`
    SELECT c.id, c.name, lks.observed_mastery AS mastery, lks.baseline_source AS "baselineSource"
    FROM learner_knowledge_states lks JOIN canonical_concepts c ON c.id = lks.canonical_concept_id
    WHERE lks.user_id = $1 ORDER BY lks.observed_mastery ASC
  `, [userId]);
  const conceptsToSkip = states.rows.filter((state) => Number(state.mastery) >= 0.8);
  const conceptsToReview = states.rows.filter((state) => Number(state.mastery) < 0.7);
  const resources = assessment.recommendedConceptId
    ? await recommendResources({ userId, conceptId: assessment.recommendedConceptId, availableMinutes: 60, limit: 4 })
    : [];
  return { assessment, startingConcept: assessment.recommendedConceptId ? { id: assessment.recommendedConceptId, name: assessment.recommendedConceptName } : null, conceptsToSkip, conceptsToReview, resources };
}

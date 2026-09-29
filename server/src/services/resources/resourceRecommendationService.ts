import { query } from "../../db/postgres.js";

export async function recommendResources(input: { userId: string; conceptId?: string; availableMinutes?: number; limit?: number }) {
  const available = Math.max(1, Number(input.availableMinutes ?? 60));
  const limit = Math.min(4, Math.max(1, Number(input.limit ?? 4)));
  const result = await query(`
    SELECT r.id, r.title, r.url, r.provider, r.resource_type AS "resourceType", r.estimated_minutes AS "estimatedMinutes",
      r.difficulty, r.description, r.trust_tier AS "trustTier", rc.coverage_strength AS "coverageStrength",
      c.id AS "conceptId", c.name AS "conceptName", COALESCE(lks.observed_mastery, 0) AS "mastery"
    FROM resources r JOIN resource_coverage rc ON rc.resource_id = r.id
    JOIN canonical_concepts c ON c.id = rc.concept_id
    LEFT JOIN learner_knowledge_states lks ON lks.canonical_concept_id = c.id AND lks.user_id = $1
    WHERE ($2::uuid IS NULL OR c.id = $2::uuid)
    ORDER BY r.trust_tier ASC, ABS(r.difficulty - GREATEST(1, LEAST(5, ROUND(COALESCE(lks.observed_mastery, 0) * 5 + 1)))) ASC, rc.coverage_strength DESC
  `, [input.userId, input.conceptId ?? null]);
  const selected = [] as any[];
  let minutes = 0;
  for (const resource of result.rows) {
    if (selected.length >= limit) break;
    if (minutes + Number(resource.estimatedMinutes) > available && selected.length > 0) continue;
    selected.push({
      ...resource,
      reason: `Current observed mastery is ${Math.round(Number(resource.mastery) * 100)}%; this resource fills the ${resource.conceptName} gap, takes ${resource.estimatedMinutes} minutes, and has trust tier ${resource.trustTier}.`,
      conceptsCovered: [resource.conceptName],
    });
    minutes += Number(resource.estimatedMinutes);
  }
  return selected;
}

import { query } from "../../db/postgres.js";

export interface KnowledgeRole {
  id: string;
  name: string;
  description: string;
  domainName: string;
  skills: Array<{ id: string; name: string; priority: number; targetMastery: number }>;
}

export async function listRoles() {
  const result = await query<KnowledgeRole>(`
    SELECT r.id, r.name, r.description, d.name AS "domainName",
      COALESCE(json_agg(json_build_object('id', s.id, 'name', s.name, 'priority', rs.priority, 'targetMastery', rs.target_mastery)
        ORDER BY rs.priority DESC) FILTER (WHERE s.id IS NOT NULL), '[]') AS skills
    FROM roles r
    JOIN knowledge_domains d ON d.id = r.domain_id
    LEFT JOIN role_skills rs ON rs.role_id = r.id
    LEFT JOIN canonical_skills s ON s.id = rs.skill_id
    GROUP BY r.id, d.name
    ORDER BY r.name
  `);
  return result.rows;
}

export async function getRole(roleId: string) {
  const result = await query<KnowledgeRole>(`
    SELECT r.id, r.name, r.description, d.name AS "domainName",
      COALESCE(json_agg(json_build_object('id', s.id, 'name', s.name, 'priority', rs.priority, 'targetMastery', rs.target_mastery)
        ORDER BY rs.priority DESC) FILTER (WHERE s.id IS NOT NULL), '[]') AS skills
    FROM roles r
    JOIN knowledge_domains d ON d.id = r.domain_id
    LEFT JOIN role_skills rs ON rs.role_id = r.id
    LEFT JOIN canonical_skills s ON s.id = rs.skill_id
    WHERE r.id = $1
    GROUP BY r.id, d.name
  `, [roleId]);
  return result.rows[0] ?? null;
}

export async function getSkill(skillId: string) {
  const result = await query(`
    SELECT s.id, s.name, s.description, s.priority, s.target_mastery AS "targetMastery",
      COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name, 'description', t.description) ORDER BY t.name)
        FILTER (WHERE t.id IS NOT NULL), '[]') AS topics
    FROM canonical_skills s
    LEFT JOIN topics t ON t.skill_id = s.id
    WHERE s.id = $1
    GROUP BY s.id
  `, [skillId]);
  return result.rows[0] ?? null;
}

export async function getConcept(conceptId: string) {
  const result = await query(`
    SELECT c.id, c.name, c.description, c.difficulty, c.status, c.version,
      t.id AS "topicId", t.name AS "topicName",
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', kp.id, 'statement', kp.statement, 'importance', kp.importance, 'difficulty', kp.difficulty)) FILTER (WHERE kp.id IS NOT NULL), '[]') AS "knowledgePoints",
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', r.id, 'title', r.title, 'url', r.url, 'provider', r.provider, 'estimatedMinutes', r.estimated_minutes, 'coverageStrength', rc.coverage_strength)) FILTER (WHERE r.id IS NOT NULL), '[]') AS resources
    FROM canonical_concepts c
    JOIN topics t ON t.id = c.topic_id
    LEFT JOIN knowledge_points kp ON kp.concept_id = c.id
    LEFT JOIN resource_coverage rc ON rc.concept_id = c.id
    LEFT JOIN resources r ON r.id = rc.resource_id
    WHERE c.id = $1
    GROUP BY c.id, t.id, t.name
  `, [conceptId]);
  return result.rows[0] ?? null;
}

export async function getConceptResources(conceptId: string) {
  const result = await query(`
    SELECT r.id, r.title, r.url, r.provider, r.resource_type AS "resourceType", r.estimated_minutes AS "estimatedMinutes",
      r.difficulty, r.description, r.trust_tier AS "trustTier", rc.coverage_strength AS "coverageStrength"
    FROM resources r JOIN resource_coverage rc ON rc.resource_id = r.id
    WHERE rc.concept_id = $1 ORDER BY r.trust_tier, r.estimated_minutes
  `, [conceptId]);
  return result.rows;
}

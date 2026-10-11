import { query } from "../../db/postgres.js";
import { displayResourceTitle } from "../resources/resourceTitle.js";

export function roadmapStatus(studied: boolean, assessed: boolean): "not_started" | "studied" | "assessed" {
  return assessed ? "assessed" : studied ? "studied" : "not_started";
}

export function rollupRoadmapStatus(statuses: Array<"not_started" | "studied" | "assessed">): "not_started" | "studied" | "assessed" {
  return statuses.includes("assessed") ? "assessed" : statuses.includes("studied") ? "studied" : "not_started";
}

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
  const row:any=result.rows[0];
  if(!row)return null;
  return {...row,resources:row.resources.map((resource:any)=>({...resource,title:displayResourceTitle(resource.title,resource.provider,resource.url)}))};
}

export async function getConceptResources(conceptId: string) {
  const result = await query(`
    SELECT r.id, r.title, r.url, r.provider, r.resource_type AS "resourceType", r.estimated_minutes AS "estimatedMinutes",
      r.difficulty, r.description, r.trust_tier AS "trustTier", rc.coverage_strength AS "coverageStrength"
    FROM resources r JOIN resource_coverage rc ON rc.resource_id = r.id
    WHERE rc.concept_id = $1 ORDER BY r.trust_tier, r.estimated_minutes
  `, [conceptId]);
  return result.rows.map((resource:any)=>({...resource,title:displayResourceTitle(resource.title,resource.provider,resource.url)}));
}

export async function getRoleRoadmap(roleId: string, userId: string) {
  const roleResult = await query<any>(`SELECT r.id, r.name, r.description, d.name AS "domainName" FROM roles r JOIN knowledge_domains d ON d.id=r.domain_id WHERE r.id=$1`, [roleId]);
  const role = roleResult.rows[0];
  if (!role) return null;
  const [nodes, prerequisites, evidence, topicEvidence, pointEvidence, resources] = await Promise.all([
    query<any>(`SELECT s.id AS skill_id,s.name AS skill_name,s.description AS skill_description,rs.priority,rs.target_mastery AS target_mastery,
      t.id AS topic_id,t.name AS topic_name,t.description AS topic_description,
      c.id AS concept_id,c.name AS concept_name,c.description AS concept_description,c.difficulty,
      kp.id AS point_id,kp.statement AS point_statement,kp.importance,kp.difficulty AS point_difficulty
      FROM role_skills rs JOIN canonical_skills s ON s.id=rs.skill_id
      LEFT JOIN topics t ON t.skill_id=s.id
      LEFT JOIN canonical_concepts c ON c.topic_id=t.id AND c.status='active'
      LEFT JOIN knowledge_points kp ON kp.concept_id=c.id
      WHERE rs.role_id=$1 ORDER BY rs.priority DESC,s.name,t.name,c.name,kp.importance DESC`, [roleId]),
    query<any>(`SELECT cp.concept_id,cp.prerequisite_concept_id,c.name AS prerequisite_name,pt.id AS prerequisite_topic_id FROM concept_prerequisites cp JOIN canonical_concepts c ON c.id=cp.prerequisite_concept_id JOIN topics pt ON pt.id=c.topic_id JOIN canonical_concepts target ON target.id=cp.concept_id JOIN topics t ON t.id=target.topic_id JOIN canonical_skills s ON s.id=t.skill_id JOIN role_skills rs ON rs.skill_id=s.id WHERE rs.role_id=$1`, [roleId]),
    query<any>(`SELECT c.id AS concept_id,
      EXISTS(SELECT 1 FROM study_sessions ss WHERE ss.user_id=$2 AND ss.canonical_concept_id=c.id AND ss.status='completed') AS studied,
      (EXISTS(SELECT 1 FROM recall_attempts ra JOIN study_sessions ss ON ss.id=ra.study_session_id WHERE ss.user_id=$2 AND ss.canonical_concept_id=c.id AND ra.submitted_at IS NOT NULL)
       OR EXISTS(SELECT 1 FROM baseline_questions bq JOIN baseline_assessments ba ON ba.id=bq.assessment_id WHERE ba.user_id=$2 AND bq.concept_id=c.id AND bq.submitted_at IS NOT NULL)) AS assessed
      FROM canonical_concepts c JOIN topics t ON t.id=c.topic_id JOIN canonical_skills s ON s.id=t.skill_id JOIN role_skills rs ON rs.skill_id=s.id WHERE rs.role_id=$1 AND c.status='active'`, [roleId,userId]),
    query<any>(`SELECT t.id AS topic_id, EXISTS(SELECT 1 FROM study_sessions ss WHERE ss.user_id=$2 AND ss.canonical_topic_id=t.id AND ss.status='completed') AS studied FROM topics t JOIN canonical_skills s ON s.id=t.skill_id JOIN role_skills rs ON rs.skill_id=s.id WHERE rs.role_id=$1`, [roleId,userId]),
    query<any>(`SELECT kp.id AS point_id,lk.last_status,lk.attempt_count,
      EXISTS(SELECT 1 FROM baseline_questions bq JOIN baseline_assessments ba ON ba.id=bq.assessment_id WHERE ba.user_id=$1 AND bq.knowledge_point_id=kp.id AND bq.submitted_at IS NOT NULL) AS baseline_assessed
      FROM knowledge_points kp LEFT JOIN learner_knowledge_point_states lk ON lk.canonical_knowledge_point_id=kp.id AND lk.user_id=$1
      JOIN canonical_concepts c ON c.id=kp.concept_id JOIN topics t ON t.id=c.topic_id JOIN canonical_skills s ON s.id=t.skill_id JOIN role_skills rs ON rs.skill_id=s.id WHERE rs.role_id=$2`, [userId,roleId]),
    query<any>(`SELECT rc.concept_id,r.id,r.title,r.url,r.provider,r.estimated_minutes FROM resource_coverage rc JOIN resources r ON r.id=rc.resource_id JOIN canonical_concepts c ON c.id=rc.concept_id JOIN topics t ON t.id=c.topic_id JOIN canonical_skills s ON s.id=t.skill_id JOIN role_skills rs ON rs.skill_id=s.id WHERE rs.role_id=$1 ORDER BY r.title`, [roleId]),
  ]);
  const stateByConcept = new Map(evidence.rows.map((row:any) => [row.concept_id, roadmapStatus(row.studied,row.assessed)]));
  const stateByTopic = new Map(topicEvidence.rows.map((row:any) => [row.topic_id,row.studied ? "studied" : "not_started"]));
  const stateByPoint = new Map(pointEvidence.rows.map((row:any) => [row.point_id,{status:row.last_status ?? (row.baseline_assessed ? "assessed" : "not_assessed"),attemptCount:Number(row.attempt_count ?? 0)}]));
  const prerequisitesByConcept = new Map<string, Array<{ id:string; name:string; topicId:string; status:string }>>();
  for (const row of prerequisites.rows) prerequisitesByConcept.set(row.concept_id,[...(prerequisitesByConcept.get(row.concept_id) ?? []),{id:row.prerequisite_concept_id,name:row.prerequisite_name,topicId:row.prerequisite_topic_id,status:stateByConcept.get(row.prerequisite_concept_id) ?? "not_started"}]);
  const resourcesByConcept = new Map<string, any[]>();
  for (const row of resources.rows) resourcesByConcept.set(row.concept_id,[...(resourcesByConcept.get(row.concept_id) ?? []),{id:row.id,title:displayResourceTitle(row.title,row.provider,row.url),url:row.url,provider:row.provider,estimatedMinutes:row.estimated_minutes}]);
  const skillMap = new Map<string, any>();
  const topicMap = new Map<string, any>();
  const conceptMap = new Map<string, any>();
  for (const row of nodes.rows) {
    if (!skillMap.has(row.skill_id)) skillMap.set(row.skill_id,{id:row.skill_id,name:row.skill_name,description:row.skill_description,priority:row.priority,targetMastery:Number(row.target_mastery),status:"not_started",topics:[]});
    const skill=skillMap.get(row.skill_id);
    if (row.topic_id && !topicMap.has(row.topic_id)) { const topic={id:row.topic_id,name:row.topic_name,description:row.topic_description,status:stateByTopic.get(row.topic_id) ?? "not_started",concepts:[]}; topicMap.set(row.topic_id,topic); skill.topics.push(topic); }
    if (row.concept_id && !conceptMap.has(row.concept_id)) { const status=stateByConcept.get(row.concept_id) ?? "not_started"; const concept={id:row.concept_id,name:row.concept_name,description:row.concept_description,difficulty:row.difficulty,status,prerequisites:prerequisitesByConcept.get(row.concept_id) ?? [],resources:resourcesByConcept.get(row.concept_id) ?? [],knowledgePoints:[]}; conceptMap.set(row.concept_id,concept); topicMap.get(row.topic_id).concepts.push(concept); }
    if (row.point_id) conceptMap.get(row.concept_id).knowledgePoints.push({id:row.point_id,statement:row.point_statement,importance:row.importance,difficulty:row.point_difficulty,evidence:stateByPoint.get(row.point_id) ?? {status:"not_assessed",attemptCount:0}});
  }
  for (const topic of topicMap.values()) topic.status=rollupRoadmapStatus([...(topic.concepts.map((concept:any)=>concept.status)),topic.status]);
  for (const skill of skillMap.values()) skill.status=rollupRoadmapStatus(skill.topics.map((topic:any)=>topic.status));
  return {...role,skills:[...skillMap.values()]};
}

export async function listRoadmaps(userId: string) {
  const roles = await listRoles();
  const roadmaps = await Promise.all(roles.map((role) => getRoleRoadmap(role.id,userId)));
  return roadmaps.filter(Boolean);
}

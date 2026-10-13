import { query, withTransaction } from "../../db/postgres.js";
import { getEvaluator } from "../evaluator/index.js";
import { AppError, notFound } from "../../utils/errors.js";
import { summarizeBaselineEvidence } from "./baselineSemantics.js";
import type { PoolClient } from "pg";

const LEVELS = ["new", "familiar", "advanced"] as const;
type BaselineLevel = (typeof LEVELS)[number];
const SELF_DECLARED_MASTERY: Record<BaselineLevel, number> = { new: 0.1, familiar: 0.45, advanced: 0.65 };
const QUESTION_COUNT: Record<BaselineLevel, number> = { new: 0, familiar: 4, advanced: 6 };

function validateLevel(value: unknown): BaselineLevel {
  if (!LEVELS.includes(value as BaselineLevel)) throw new AppError("Invalid starting level", 400, "VALIDATION_ERROR");
  return value as BaselineLevel;
}

export async function createBaseline(input: { userId: string; goalId: string; skillId: string; level: string; trustMe?: boolean }) {
  const level = validateLevel(input.level);
  const source = input.trustMe ? "self_declared" : level === "new" ? "skipped" : "assessed";
  const selfDeclared = SELF_DECLARED_MASTERY[level];
  const result = await query<{ id: string }>(
    `INSERT INTO baseline_assessments (user_id, goal_id, skill_id, selected_level, baseline_source, baseline_confidence, status, self_declared_mastery)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [input.userId, input.goalId, input.skillId, level, source, source === "assessed" ? 0.35 : 0.25, source === "assessed" ? "pending" : "completed", selfDeclared],
  );
  const assessmentId = result.rows[0].id;

  if (source !== "assessed") {
    await upsertLearnerState(input.userId, input.skillId, selfDeclared, 0, source);
    return getBaseline(assessmentId, input.userId);
  }

  const concepts = await query<{ id: string; name: string; description: string; statement: string }>(
    `SELECT c.id, c.name, c.description, kp.statement
     FROM canonical_concepts c JOIN topics t ON t.id = c.topic_id
     JOIN LATERAL (SELECT statement FROM knowledge_points WHERE concept_id=c.id ORDER BY importance DESC, id LIMIT 1) kp ON true
     WHERE t.skill_id = $1 ORDER BY c.difficulty, c.name LIMIT $2`,
    [input.skillId, QUESTION_COUNT[level]],
  );
  const blueprints = [
    ["L1", "Explain this core idea about {name}: {point}"],
    ["L2", "Explain {point} from memory, then state one tradeoff."],
    ["L3", "Apply {point} in a backend system and explain your choice."],
    ["L4", "What failure mode could undermine {point}, and how would you detect it?"],
    ["L5", "How would {point} change in a distributed system with competing constraints?"],
  ] as const;
  for (let index = 0; index < concepts.rows.length; index += 1) {
    const concept = concepts.rows[index];
    const blueprint = blueprints[index % blueprints.length];
    await query(
      `INSERT INTO baseline_questions (assessment_id, concept_id, knowledge_point_id, level, question)
       SELECT $1, $2, kp.id, $3, $4 FROM knowledge_points kp WHERE kp.concept_id = $2 ORDER BY kp.importance DESC LIMIT 1`,
      [assessmentId, concept.id, blueprint[0], blueprint[1].replaceAll("{name}", concept.name).replaceAll("{point}", concept.statement)],
    );
  }
  if (!concepts.rows.length) {
    await query(`UPDATE baseline_assessments SET status='completed', observed_mastery=NULL, updated_at=now() WHERE id=$1 AND user_id=$2`, [assessmentId,input.userId]);
  }
  return getBaseline(assessmentId, input.userId);
}

export async function getBaseline(id: string, userId: string) {
  const assessment = await query(`SELECT id, goal_id AS "goalId", skill_id AS "skillId", selected_level AS "selectedLevel", baseline_source AS "baselineSource", baseline_confidence AS "baselineConfidence", status, observed_mastery AS "observedMastery", self_declared_mastery AS "selfDeclaredMastery", recommended_concept_id AS "recommendedConceptId", created_at AS "createdAt" FROM baseline_assessments WHERE id = $1 AND user_id = $2`, [id, userId]);
  if (!assessment.rows[0]) throw notFound("Baseline assessment not found", "BASELINE_NOT_FOUND");
  const questions = await query(`SELECT id, concept_id AS "conceptId", knowledge_point_id AS "knowledgePointId", level, question, answer, coverage, confidence, knowledge_point_results AS "knowledgePointResults", submitted_at AS "submittedAt" FROM baseline_questions WHERE assessment_id = $1 ORDER BY id`, [id]);
  const evidence = summarizeBaselineEvidence(questions.rows as any);
  return { assessment: { ...assessment.rows[0], observedEvidenceCount: evidence.evidenceCount, observedStatus: evidence.status }, questions: questions.rows };
}

export async function submitBaselineQuestion(assessmentId: string, userId: string, input: { questionId: string; answer: string; confidence: number }) {
  if (!input.answer?.trim()) throw new AppError("Answer cannot be empty", 400, "EMPTY_ANSWER");
  if (!Number.isInteger(input.confidence) || input.confidence < 1 || input.confidence > 10) throw new AppError("Confidence must be from 1 to 10", 400, "VALIDATION_ERROR");
  const question = await query<{ id: string; conceptId: string; name: string; description: string; points: string[] }>(
    `SELECT bq.id, c.id AS "conceptId", c.name, c.description, array_agg(DISTINCT kp.statement ORDER BY kp.statement) AS points
     FROM baseline_questions bq JOIN baseline_assessments ba ON ba.id = bq.assessment_id
     JOIN canonical_concepts c ON c.id = bq.concept_id JOIN knowledge_points kp ON kp.concept_id = c.id AND (kp.id = bq.knowledge_point_id OR bq.knowledge_point_id IS NULL)
    WHERE bq.id = $1 AND ba.id = $2 AND ba.user_id = $3 GROUP BY bq.id, c.id`, [input.questionId, assessmentId, userId],
  );
  if (!question.rows[0]) throw notFound("Baseline question not found", "BASELINE_QUESTION_NOT_FOUND");
  const row = question.rows[0];
  const evaluation = await getEvaluator().evaluate({ conceptName: row.name, conceptDescription: row.description, requiredKnowledgePoints: row.points, answer: input.answer.trim(), questionType: "application" });
  await withTransaction(async (client) => {
    const assessmentLock = await client.query(`SELECT id FROM baseline_assessments WHERE id=$1 AND user_id=$2 FOR UPDATE`, [assessmentId, userId]);
    if (!assessmentLock.rows[0]) throw notFound("Baseline assessment not found", "BASELINE_NOT_FOUND");
    const saved = await client.query(
      `UPDATE baseline_questions SET answer=$1,coverage=$2,confidence=$3,knowledge_point_results=$4,submitted_at=now()
       WHERE id=$5 AND assessment_id=$6 AND submitted_at IS NULL RETURNING id`,
      [input.answer.trim(), evaluation.overallCoverage, input.confidence, JSON.stringify(evaluation.knowledgePointResults), input.questionId, assessmentId],
    );
    if (!saved.rows[0]) throw new AppError("This baseline question has already been submitted.", 409, "BASELINE_QUESTION_ALREADY_SUBMITTED");
    await refreshBaseline(client, assessmentId, userId);
  });
  return getBaseline(assessmentId, userId);
}

async function refreshBaseline(client: PoolClient, id: string, userId: string) {
  const aggregate = await client.query<{ count: string; answered: string }>(
    `SELECT count(*)::text AS count, count(coverage)::text AS answered FROM baseline_questions WHERE assessment_id = $1`, [id]);
  const row = aggregate.rows[0];
  if (Number(row.count) !== Number(row.answered)) return;
  const evidence = await client.query<{ conceptId:string; knowledgePointId:string|null; knowledgePointResults:any }>(
    `SELECT concept_id AS "conceptId", knowledge_point_id AS "knowledgePointId", knowledge_point_results AS "knowledgePointResults" FROM baseline_questions WHERE assessment_id=$1 AND submitted_at IS NOT NULL ORDER BY id`,[id]);
  const points = new Map<string,{status:string}>();
  for(const item of evidence.rows){
    const results=Array.isArray(item.knowledgePointResults)?item.knowledgePointResults:[];
    for(const result of results){
      const normalizedLabel=String(result.point??"").trim().toLowerCase().replace(/\s+/g," ");
      const key=item.knowledgePointId??`${item.conceptId}:${normalizedLabel}`;
      if(key.endsWith(":"))continue;
      const prior=points.get(key);
      const rank=(status:string)=>status==="correct"?2:status==="partial"?1:0;
      if(!prior||rank(result.status)<rank(prior.status))points.set(key,{status:result.status});
    }
  }
  if(!points.size){
    await client.query(`UPDATE baseline_assessments SET status='completed',observed_mastery=NULL,baseline_confidence=NULL,recommended_concept_id=NULL,updated_at=now() WHERE id=$1 AND user_id=$2`,[id,userId]);
    return;
  }
  const mastery=Array.from(points.values()).reduce((sum,item)=>sum+(item.status==="correct"?1:item.status==="partial"?.5:0),0)/points.size;
  const confidenceResult=await client.query<{confidence:number}>(`SELECT avg(confidence)/10 AS confidence FROM baseline_questions WHERE assessment_id=$1 AND submitted_at IS NOT NULL`,[id]);
  const weakest=(await client.query<{conceptId:string}>(`SELECT concept_id AS "conceptId" FROM baseline_questions WHERE assessment_id=$1 AND submitted_at IS NOT NULL ORDER BY coverage ASC,id LIMIT 1`,[id])).rows[0];
  await client.query(`UPDATE baseline_assessments SET status = 'completed', observed_mastery = $1, baseline_confidence = $2, recommended_concept_id = $3, updated_at = now() WHERE id = $4 AND user_id = $5`, [mastery, confidenceResult.rows[0]?.confidence ?? null, weakest?.conceptId ?? null, id, userId]);
  await client.query(`INSERT INTO learner_knowledge_states (user_id, canonical_concept_id, observed_mastery, observed_confidence, baseline_source, last_assessed_at)
    SELECT $1, concept_id, coverage, confidence / 10, 'assessed', now() FROM baseline_questions WHERE assessment_id = $2
    ON CONFLICT (user_id, canonical_concept_id) DO UPDATE SET observed_mastery = EXCLUDED.observed_mastery, observed_confidence = EXCLUDED.observed_confidence, baseline_source = 'assessed', last_assessed_at = now()`, [userId, id]);
}

async function upsertLearnerState(userId: string, skillId: string, mastery: number, confidence: number, source: string) {
  await query(`INSERT INTO learner_knowledge_states (user_id, canonical_concept_id, self_declared_mastery, observed_confidence, baseline_source)
    SELECT $1, c.id, $2, $3, $4 FROM canonical_concepts c JOIN topics t ON t.id = c.topic_id WHERE t.skill_id = $5
    ON CONFLICT (user_id, canonical_concept_id) DO UPDATE SET self_declared_mastery = EXCLUDED.self_declared_mastery, baseline_source = EXCLUDED.baseline_source`, [userId, mastery, confidence, source, skillId]);
}

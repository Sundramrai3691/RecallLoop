import { query, withTransaction } from "../../db/postgres.js";
import { getEvaluator } from "../evaluator/index.js";
import { AppError, notFound } from "../../utils/errors.js";

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
     FROM canonical_concepts c JOIN topics t ON t.id = c.topic_id JOIN knowledge_points kp ON kp.concept_id = c.id
     WHERE t.skill_id = $1 ORDER BY c.difficulty, c.name LIMIT $2`,
    [input.skillId, QUESTION_COUNT[level]],
  );
  const blueprints = [
    ["L1", "What is the core idea of {name}?"],
    ["L2", "Explain {name} from memory and name an important tradeoff."],
    ["L3", "Apply {name} to a backend system you are designing."],
    ["L4", "What failure mode or scaling issue changes how you use {name}?"],
    ["L5", "Transfer {name} to a distributed system with competing constraints."],
  ] as const;
  for (let index = 0; index < concepts.rows.length; index += 1) {
    const concept = concepts.rows[index];
    const blueprint = blueprints[index % blueprints.length];
    await query(
      `INSERT INTO baseline_questions (assessment_id, concept_id, knowledge_point_id, level, question)
       SELECT $1, $2, kp.id, $3, $4 FROM knowledge_points kp WHERE kp.concept_id = $2 ORDER BY kp.importance DESC LIMIT 1`,
      [assessmentId, concept.id, blueprint[0], blueprint[1].replace("{name}", concept.name)],
    );
  }
  return getBaseline(assessmentId, input.userId);
}

export async function getBaseline(id: string, userId: string) {
  const assessment = await query(`SELECT id, goal_id AS "goalId", skill_id AS "skillId", selected_level AS "selectedLevel", baseline_source AS "baselineSource", baseline_confidence AS "baselineConfidence", status, observed_mastery AS "observedMastery", self_declared_mastery AS "selfDeclaredMastery", recommended_concept_id AS "recommendedConceptId", created_at AS "createdAt" FROM baseline_assessments WHERE id = $1 AND user_id = $2`, [id, userId]);
  if (!assessment.rows[0]) throw notFound("Baseline assessment not found", "BASELINE_NOT_FOUND");
  const questions = await query(`SELECT id, concept_id AS "conceptId", level, question, answer, coverage, confidence, knowledge_point_results AS "knowledgePointResults", submitted_at AS "submittedAt" FROM baseline_questions WHERE assessment_id = $1 ORDER BY id`, [id]);
  return { assessment: assessment.rows[0], questions: questions.rows };
}

export async function submitBaselineQuestion(assessmentId: string, userId: string, input: { questionId: string; answer: string; confidence: number }) {
  if (!input.answer?.trim()) throw new AppError("Answer cannot be empty", 400, "EMPTY_ANSWER");
  if (!Number.isInteger(input.confidence) || input.confidence < 1 || input.confidence > 10) throw new AppError("Confidence must be from 1 to 10", 400, "VALIDATION_ERROR");
  const question = await query<{ id: string; conceptId: string; name: string; description: string; points: string[] }>(
    `SELECT bq.id, c.id AS "conceptId", c.name, c.description, array_agg(kp.statement) AS points
     FROM baseline_questions bq JOIN baseline_assessments ba ON ba.id = bq.assessment_id
     JOIN canonical_concepts c ON c.id = bq.concept_id JOIN knowledge_points kp ON kp.concept_id = c.id
    WHERE bq.id = $1 AND ba.id = $2 AND ba.user_id = $3 GROUP BY bq.id, c.id`, [input.questionId, assessmentId, userId],
  );
  if (!question.rows[0]) throw notFound("Baseline question not found", "BASELINE_QUESTION_NOT_FOUND");
  const row = question.rows[0];
  const evaluation = await getEvaluator().evaluate({ conceptName: row.name, conceptDescription: row.description, requiredKnowledgePoints: row.points, answer: input.answer.trim(), questionType: "application" });
  await query(`UPDATE baseline_questions SET answer = $1, coverage = $2, confidence = $3, knowledge_point_results = $4, submitted_at = now() WHERE id = $5`, [input.answer.trim(), evaluation.overallCoverage, input.confidence, JSON.stringify(evaluation.knowledgePointResults), input.questionId]);
  await refreshBaseline(assessmentId, userId);
  return getBaseline(assessmentId, userId);
}

async function refreshBaseline(id: string, userId: string) {
  const aggregate = await query<{ count: string; answered: string; mastery: number; confidence: number; conceptId: string }>(
    `SELECT count(*)::text, count(coverage)::text, COALESCE(avg(coverage), 0) AS mastery, COALESCE(avg(confidence) / 10, 0) AS confidence,
      (array_agg(concept_id ORDER BY coverage ASC NULLS FIRST))[1] AS "conceptId"
     FROM baseline_questions WHERE assessment_id = $1`, [id]);
  const row = aggregate.rows[0];
  if (Number(row.count) !== Number(row.answered)) return;
  await withTransaction(async (client) => {
    await client.query(`UPDATE baseline_assessments SET status = 'completed', observed_mastery = $1, baseline_confidence = $2, recommended_concept_id = $3, updated_at = now() WHERE id = $4 AND user_id = $5`, [row.mastery, row.confidence, row.conceptId, id, userId]);
    await client.query(`INSERT INTO learner_knowledge_states (user_id, canonical_concept_id, observed_mastery, observed_confidence, baseline_source, last_assessed_at)
      SELECT $1, concept_id, coverage, confidence / 10, 'assessed', now() FROM baseline_questions WHERE assessment_id = $2
      ON CONFLICT (user_id, canonical_concept_id) DO UPDATE SET observed_mastery = EXCLUDED.observed_mastery, observed_confidence = EXCLUDED.observed_confidence, baseline_source = 'assessed', last_assessed_at = now()`, [userId, id]);
  });
}

async function upsertLearnerState(userId: string, skillId: string, mastery: number, confidence: number, source: string) {
  await query(`INSERT INTO learner_knowledge_states (user_id, canonical_concept_id, self_declared_mastery, observed_confidence, baseline_source)
    SELECT $1, c.id, $2, $3, $4 FROM canonical_concepts c JOIN topics t ON t.id = c.topic_id WHERE t.skill_id = $5
    ON CONFLICT (user_id, canonical_concept_id) DO UPDATE SET self_declared_mastery = EXCLUDED.self_declared_mastery, baseline_source = EXCLUDED.baseline_source`, [userId, mastery, confidence, source, skillId]);
}

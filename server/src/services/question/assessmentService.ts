import { withTransaction, query } from "../../db/postgres.js";
import { getAttempt } from "../../repositories/legacyPostgresRepositories.js";
import { AppError, notFound } from "../../utils/errors.js";
import { assessmentBlueprint, buildQuestion } from "./questionService.js";

export type AssessmentMode = "rapid_fire" | "deep_recall" | "mastery_check";
const DIMENSIONS = ["recognition","recall","explanation","application","depth","transfer"];

export async function createAssessment(userId: string, conceptId: string, mode: AssessmentMode) {
  if (!new Set(["rapid_fire","deep_recall","mastery_check"]).has(mode)) throw new AppError("Invalid assessment mode",400,"VALIDATION_ERROR");
  const result = await query<any>(`SELECT * FROM personal_concepts WHERE id=$1 AND user_id=$2`,[conceptId,userId]);
  const concept = result.rows[0];
  if (!concept) throw notFound("Concept not found","MISSING_CONCEPT");
  const attempts = await withTransaction(async (client) => {
    const session = await client.query<any>(`INSERT INTO assessment_sessions(user_id,concept_id,mode) VALUES($1,$2,$3) RETURNING id`,[userId,conceptId,mode]);
    const attemptIds: string[] = [];
    const blueprint = assessmentBlueprint(mode);
    for (let index=0; index<blueprint.length; index++) {
      const draft = buildQuestion(concept.name,blueprint[index],concept.required_knowledge_points,Math.min(5,Number(concept.difficulty)),index);
      const question = await client.query<any>(`INSERT INTO questions(concept_id,question_type,assessment_level,difficulty,title,context,prompt,estimated_minutes,source,options,correct_option_id,explanation,knowledge_points,hints) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'builtin',$9,$10,$11,$12,$13) RETURNING id`,[conceptId,draft.questionType,draft.assessmentLevel,draft.difficulty,draft.title,draft.context,draft.prompt,draft.estimatedMinutes,draft.options ? JSON.stringify(draft.options) : null,draft.correctOptionId,draft.explanation,draft.knowledgePoints,draft.hints]);
      const attempt = await client.query<any>(`INSERT INTO recall_attempts(user_id,concept_id,study_session_id,question_type,question,question_id,assessment_session_id,assessment_position) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,[userId,conceptId,concept.study_session_id,draft.questionType,draft.prompt,question.rows[0].id,session.rows[0].id,index+1]);
      attemptIds.push(attempt.rows[0].id);
    }
    return { id: session.rows[0].id, attemptIds, mode };
  });
  const questions = [];
  for (const id of attempts.attemptIds) questions.push(await getAttempt(id,userId));
  return { assessment: { id: attempts.id, mode: attempts.mode, status: "in_progress", current: 1, total: attempts.attemptIds.length }, questions };
}

export async function getAssessment(userId: string, assessmentId: string) {
  const sessionResult = await query<any>(`SELECT * FROM assessment_sessions WHERE id=$1 AND user_id=$2`,[assessmentId,userId]);
  const session = sessionResult.rows[0];
  if (!session) throw notFound("Assessment not found","ASSESSMENT_NOT_FOUND");
  const rows = await query<any>(`SELECT id,assessment_position,submitted_at FROM recall_attempts WHERE assessment_session_id=$1 ORDER BY assessment_position`,[assessmentId]);
  const questions=[];
  for (const row of rows.rows) questions.push(await getAttempt(row.id,userId));
  const complete = questions.length > 0 && questions.every((item:any) => Boolean(item?.submittedAt));
  if (complete && !session.completed_at) await query(`UPDATE assessment_sessions SET completed_at=now() WHERE id=$1`,[assessmentId]);
  const dimensions = await query<any>(`SELECT d.dimension,AVG(d.score)::float AS score FROM recall_dimension_results d JOIN recall_attempts r ON r.id=d.recall_attempt_id WHERE r.assessment_session_id=$1 GROUP BY d.dimension`,[assessmentId]);
  const scores = Object.fromEntries(DIMENSIONS.map((name) => [name,dimensions.rows.find((item) => item.dimension === name)?.score ?? null]));
  const submitted = questions.filter((item:any) => item?.submittedAt);
  const correct = submitted.filter((item:any) => item.resultStatus === "correct").length;
  return { assessment: { id: session.id, mode: session.mode, status: complete ? "completed" : "in_progress", current: Math.min(rows.rows.findIndex((item:any) => !item.submitted_at)+1 || questions.length,questions.length), total: questions.length }, questions, result: complete ? { correct, total: questions.length, dimensionScores: scores, weakArea: Object.entries(scores).filter(([,score])=>score!==null).sort((a:any,b:any)=>a[1]-b[1])[0]?.[0] ?? null } : null };
}

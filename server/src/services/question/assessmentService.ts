import { withTransaction, query } from "../../db/postgres.js";
import { getAttempt } from "../../repositories/legacyPostgresRepositories.js";
import { AppError, notFound } from "../../utils/errors.js";
import { assessmentBlueprint, buildQuestion, buildTargetedVerificationQuestion, upsertQuestion } from "./questionService.js";
import { findBuiltinMcq } from "./mcqBank.js";

export type AssessmentMode = "rapid_fire" | "deep_recall" | "mastery_check" | "practice";
const DIMENSIONS = ["recognition","recall","explanation","application","depth","transfer"];

export async function createAssessment(userId: string, conceptId: string, mode: AssessmentMode) {
  if (!new Set(["rapid_fire","deep_recall","mastery_check","practice"]).has(mode)) throw new AppError("Invalid assessment mode",400,"VALIDATION_ERROR");
  const result = await query<any>(`SELECT * FROM personal_concepts WHERE id=$1 AND user_id=$2`,[conceptId,userId]);
  const concept = result.rows[0];
  if (!concept) throw notFound("Concept not found","MISSING_CONCEPT");
  const attempts = await withTransaction(async (client) => {
    const session = await client.query<any>(`INSERT INTO assessment_sessions(user_id,concept_id,mode) VALUES($1,$2,$3) RETURNING id`,[userId,conceptId,mode]);
    const attemptIds: string[] = [];
    const blueprint = assessmentBlueprint(mode);
    const history=await client.query<any>(`SELECT question_id FROM recall_attempts WHERE user_id=$1 AND concept_id=$2 ORDER BY created_at DESC LIMIT 20`,[userId,conceptId]);
    const recentIds=new Set<string>(history.rows.map((row)=>row.question_id).filter(Boolean));
    const review=await client.query<any>(`SELECT due_at<=now() AS due FROM review_states WHERE user_id=$1 AND concept_id=$2`,[userId,conceptId]);
    const failures=await client.query<any>(`SELECT count(*)::int AS count FROM (SELECT e.overall_coverage FROM recall_attempts r JOIN recall_evaluations e ON e.recall_attempt_id=r.id WHERE r.user_id=$1 AND r.concept_id=$2 ORDER BY r.submitted_at DESC LIMIT 3) recent WHERE overall_coverage<.55`,[userId,conceptId]);
    for (let index=0; index<blueprint.length; index++) {
      const target=concept.required_knowledge_points[index % Math.max(1,concept.required_knowledge_points.length)];
      const type=blueprint[index]==="mcq"&&!findBuiltinMcq(concept.name,target??"",index)?"rapid_recall":blueprint[index];
      let draft=buildQuestion(concept.name,type,concept.required_knowledge_points,Math.min(5,Number(concept.difficulty)),index,0);
      let questionId=await upsertQuestion(client,conceptId,draft);
      for(let variant=1;recentIds.has(questionId)&&variant<8;variant++){draft=buildQuestion(concept.name,type,concept.required_knowledge_points,Math.min(5,Number(concept.difficulty)),index+variant,variant);questionId=await upsertQuestion(client,conceptId,draft);}
      const repeated=recentIds.has(questionId);
      const repetitionReason=repeated?(Number(failures.rows[0]?.count)>=2?"remediation":mode==="mastery_check"||Number(concept.mastery)>=.75?"mastery_confirmation":review.rows[0]?.due?"spaced_recall":null):null;
      const attempt = await client.query<any>(`INSERT INTO recall_attempts(user_id,concept_id,study_session_id,question_type,question,question_id,assessment_session_id,assessment_position,repetition_reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,[userId,conceptId,concept.study_session_id,draft.questionType,draft.prompt,questionId,session.rows[0].id,index+1,repetitionReason]);
      recentIds.add(questionId);
      attemptIds.push(attempt.rows[0].id);
    }
    return { id: session.rows[0].id, attemptIds, mode };
  });
  const questions = [];
  for (const id of attempts.attemptIds) questions.push(await getAttempt(id,userId));
  return { assessment: { id: attempts.id, mode: attempts.mode, status: "in_progress", current: 1, total: attempts.attemptIds.length }, questions };
}

export async function createTargetedVerification(userId:string,remediationId:string) {
  const attemptId=await withTransaction(async(client)=>{
    const result=await client.query<any>(`SELECT r.id,r.user_id,r.concept_id,r.knowledge_point,r.status,r.verification_attempt_id,c.name,c.study_session_id,c.difficulty
      FROM grounded_remediations r JOIN personal_concepts c ON c.id=r.concept_id AND c.user_id=r.user_id WHERE r.id=$1 AND r.user_id=$2 FOR UPDATE OF r`,[remediationId,userId]);
    const remediation=result.rows[0];
    if(!remediation)throw notFound("Remediation not found","REMEDIATION_NOT_FOUND");
    if(remediation.verification_attempt_id)return remediation.verification_attempt_id as string;
    if(remediation.status!=="ready")throw new AppError("Remediation is not ready for verification",409,"REMEDIATION_NOT_READY");
    const history=await client.query<any>(`SELECT question_id FROM recall_attempts WHERE user_id=$1 AND concept_id=$2 AND question_id IS NOT NULL ORDER BY created_at DESC LIMIT 20`,[userId,remediation.concept_id]);
    const recentIds=new Set<string>(history.rows.map((row)=>row.question_id));
    let draft=buildTargetedVerificationQuestion(remediation.name,remediation.knowledge_point,0);
    let questionId="";
    for(let variant=0;variant<6;variant++){
      draft=buildTargetedVerificationQuestion(remediation.name,remediation.knowledge_point,variant);
      questionId=await upsertQuestion(client,remediation.concept_id,draft);
      if(!recentIds.has(questionId))break;
      questionId="";
    }
    if(!questionId)throw new AppError("No unseen targeted verification wording is available yet",409,"NO_FRESH_VERIFICATION");
    const session=await client.query<any>(`INSERT INTO assessment_sessions(user_id,concept_id,mode) VALUES($1,$2,'practice') RETURNING id`,[userId,remediation.concept_id]);
    const attempt=await client.query<any>(`INSERT INTO recall_attempts(user_id,concept_id,study_session_id,question_type,question,question_id,assessment_session_id,assessment_position,remediation_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,1,$8) RETURNING id`,[userId,remediation.concept_id,remediation.study_session_id,draft.questionType,draft.prompt,questionId,session.rows[0].id,remediationId]);
    await client.query(`UPDATE grounded_remediations SET status='verification_created',verification_attempt_id=$2,updated_at=now() WHERE id=$1`,[remediationId,attempt.rows[0].id]);
    return attempt.rows[0].id as string;
  });
  return getAttempt(attemptId,userId);
}

export interface AssessmentEvidenceSummary {
  correct: number;
  partial: number;
  incorrect: number;
  unanswered: number;
  total: number;
  uniqueAssessedPoints: number;
  totalConceptPoints: number;
  pointCoverage: number;
  maturityStatus: "Early signal" | "Strong" | "Developing" | "Needs work" | "Not assessed";
  conceptMastery: number | null;
  points: {
    correct: Array<{ point: string; status: "correct" | "partial" | "missing"; feedback: string }>;
    partial: Array<{ point: string; status: "correct" | "partial" | "missing"; feedback: string }>;
    missing: Array<{ point: string; status: "correct" | "partial" | "missing"; feedback: string }>;
  };
}

export function summarizeAssessmentEvidence(
  questions: any[],
  requiredKnowledgePoints: string[] = [],
  conceptMastery: number | null = null
): AssessmentEvidenceSummary {
  const total = questions.length;
  const submitted = questions.filter((q) => Boolean(q?.submittedAt));
  const correct = submitted.filter((q) => q.resultStatus === "correct").length;
  const partial = submitted.filter((q) => q.resultStatus === "partial").length;
  const incorrect = submitted.filter((q) => q.resultStatus === "incorrect").length;
  const unanswered = total - submitted.length;

  const unique = new Map<string, { point: string; status: "correct" | "partial" | "missing"; feedback: string }>();
  for (const q of submitted) {
    const results = q.evaluation?.knowledgePointResults ?? [];
    for (const r of results) {
      const label = String(r.point ?? "").trim();
      const norm = label.toLowerCase().replace(/\s+/g, " ");
      if (!norm) continue;
      const prev = unique.get(norm);
      const rank = (s: string) => (s === "correct" ? 2 : s === "partial" ? 1 : 0);
      if (!prev || rank(r.status) < rank(prev.status)) {
        unique.set(norm, {
          point: label,
          status: r.status,
          feedback: r.feedback ?? "",
        });
      }
    }
  }

  const pointList = [...unique.values()];
  const points = {
    correct: pointList.filter((p) => p.status === "correct"),
    partial: pointList.filter((p) => p.status === "partial"),
    missing: pointList.filter((p) => p.status === "missing"),
  };

  const uniqueAssessedPoints = unique.size;
  const totalConceptPoints = requiredKnowledgePoints.length;
  const pointCoverage = totalConceptPoints > 0
    ? Number((uniqueAssessedPoints / totalConceptPoints).toFixed(4))
    : uniqueAssessedPoints > 0 ? 1 : 0;

  let maturityStatus: "Early signal" | "Strong" | "Developing" | "Needs work" | "Not assessed";
  if (uniqueAssessedPoints === 0) {
    maturityStatus = "Not assessed";
  } else if (uniqueAssessedPoints < 3 || (totalConceptPoints > 0 && uniqueAssessedPoints < totalConceptPoints)) {
    maturityStatus = "Early signal";
  } else {
    const score = pointList.reduce((sum, p) => sum + (p.status === "correct" ? 1 : p.status === "partial" ? 0.5 : 0), 0) / uniqueAssessedPoints;
    maturityStatus = score >= 0.7 ? "Strong" : score >= 0.35 ? "Developing" : "Needs work";
  }

  return {
    correct,
    partial,
    incorrect,
    unanswered,
    total,
    uniqueAssessedPoints,
    totalConceptPoints,
    pointCoverage,
    maturityStatus,
    conceptMastery,
    points,
  };
}

export async function getAssessment(userId: string, assessmentId: string) {
  const sessionResult = await query<any>(`SELECT * FROM assessment_sessions WHERE id=$1 AND user_id=$2`,[assessmentId,userId]);
  const session = sessionResult.rows[0];
  if (!session) throw notFound("Assessment not found","ASSESSMENT_NOT_FOUND");
  const conceptResult = await query<any>(`SELECT name, required_knowledge_points, mastery FROM personal_concepts WHERE id=$1 AND user_id=$2`,[session.concept_id,userId]);
  const conceptRow = conceptResult.rows[0];
  const rows = await query<any>(`SELECT id,assessment_position,submitted_at FROM recall_attempts WHERE assessment_session_id=$1 ORDER BY assessment_position`,[assessmentId]);
  const questions=[];
  for (const row of rows.rows) questions.push(await getAttempt(row.id,userId));
  const complete = questions.length > 0 && questions.every((item:any) => Boolean(item?.submittedAt));
  if (complete && !session.completed_at) await query(`UPDATE assessment_sessions SET completed_at=now() WHERE id=$1`,[assessmentId]);
  const dimensions = await query<any>(`SELECT d.dimension,AVG(d.score)::float AS score FROM recall_dimension_results d JOIN recall_attempts r ON r.id=d.recall_attempt_id WHERE r.assessment_session_id=$1 GROUP BY d.dimension`,[assessmentId]);
  const recommendationResult=complete?await query<any>(`SELECT rec.action_type AS "actionType",rec.title,rec.reason,rec.estimated_minutes AS "estimatedMinutes",rec.priority FROM recall_attempts r JOIN assessment_recommendations rec ON rec.recall_attempt_id=r.id WHERE r.assessment_session_id=$1 ORDER BY rec.priority DESC,r.assessment_position LIMIT 1`,[assessmentId]):{rows:[]};
  const scores = Object.fromEntries(DIMENSIONS.map((name) => [name,dimensions.rows.find((item) => item.dimension === name)?.score ?? null]));
  const summary = summarizeAssessmentEvidence(
    questions,
    conceptRow?.required_knowledge_points ?? [],
    conceptRow ? Number(conceptRow.mastery) : null
  );
  return {
    assessment: {
      id: session.id,
      conceptId: session.concept_id,
      mode: session.mode,
      status: complete ? "completed" : "in_progress",
      current: Math.min(rows.rows.findIndex((item:any) => !item.submitted_at)+1 || questions.length,questions.length),
      total: questions.length
    },
    questions,
    result: complete ? {
      ...summary,
      dimensionScores: scores,
      weakArea: Object.entries(scores).filter(([,score])=>score!==null).sort((a:any,b:any)=>a[1]-b[1])[0]?.[0] ?? null,
      recommendation: recommendationResult.rows[0] ?? null
    } : null
  };
}

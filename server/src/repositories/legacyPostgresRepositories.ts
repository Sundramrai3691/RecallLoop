import { query, withTransaction } from "../db/postgres.js";
import type { PoolClient } from "pg";
import { AppError } from "../utils/errors.js";
import type { ReviewStateSnapshot } from "../services/scheduler/types.js";

export function mapSession(row: any) { return { id: row.id, userId: row.user_id, title: row.title, rawMaterial: row.raw_material, sourceType: row.source_type, sourceUrl: row.source_url ?? null, groundingSourceId: row.grounding_source_id ?? null, canonicalTopicId: row.canonical_topic_id ?? null, canonicalConceptId: row.canonical_concept_id ?? null, startedAt: row.started_at, completedAt: row.completed_at, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at }; }
export function mapConcept(row: any) { return { id: row.id, userId: row.user_id, studySessionId: row.study_session_id, name: row.name, description: row.description, canonicalConceptId: row.canonical_concept_id ?? null, parentConceptId: row.parent_concept_id, requiredKnowledgePoints: row.required_knowledge_points, difficulty: row.difficulty, mastery: Number(row.mastery), createdAt: row.created_at, updatedAt: row.updated_at }; }
export function mapReview(row: any) { return row ? { id: row.id, userId: row.user_id, conceptId: row.concept_id, state: row.state, dueAt: row.due_at, intervalDays: row.interval_days, stability: Number(row.stability), difficulty: Number(row.difficulty), lastRecallAt: row.last_recall_at, lastOutcome: row.last_outcome, consecutiveSuccesses: row.consecutive_successes, updatedAt: row.updated_at } : null; }

async function evaluationForAttempt(attemptId: string) {
  const result = await query<any>(`SELECT e.*, COALESCE(json_agg(json_build_object('point',r.point,'status',r.status,'evidence',r.evidence,'feedback',r.feedback,'partId',r.part_id,'canonicalKnowledgePointId',r.canonical_knowledge_point_id) ORDER BY r.id) FILTER (WHERE r.id IS NOT NULL), '[]') AS knowledge_point_results FROM recall_evaluations e LEFT JOIN recall_knowledge_point_results r ON r.evaluation_id=e.id WHERE e.recall_attempt_id=$1 GROUP BY e.id`, [attemptId]);
  const row = result.rows[0];
  return row ? { overallCoverage: Number(row.overall_coverage), knowledgePointResults: row.knowledge_point_results, missingConcepts: row.missing_concepts, mistakes: row.mistakes, strengths: row.strengths, feedback: row.feedback, suggestedRecallType: row.suggested_recall_type, evaluatorVersion: row.evaluator_version } : null;
}

export async function resolveCanonicalKnowledgePoint(client: PoolClient, attemptId: string, pointText: string): Promise<string | null> {
  const result=await client.query<{id:string|null}>(`SELECT CASE WHEN count(kp.id)=1 THEN (array_agg(kp.id))[1] END AS id
    FROM recall_attempts ra JOIN study_sessions ss ON ss.id=ra.study_session_id
    LEFT JOIN knowledge_points kp ON kp.concept_id=ss.canonical_concept_id
      AND lower(regexp_replace(trim(kp.statement),'[[:space:]]+',' ','g'))=lower(regexp_replace(trim($2),'[[:space:]]+',' ','g'))
    WHERE ra.id=$1`,[attemptId,pointText]);
  return result.rows[0]?.id ?? null;
}
export async function getAttempt(id: string, userId: string) {
  const result = await query<any>(`SELECT * FROM recall_attempts WHERE id=$1 AND user_id=$2`, [id,userId]);
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  const questionResult = row.question_id ? await query<any>(`SELECT * FROM questions WHERE id=$1`, [row.question_id]) : { rows: [] } as any;
  const question = questionResult.rows[0];
  const recommendationResult = await query<any>(`SELECT action_type AS "actionType",title,reason,estimated_minutes AS "estimatedMinutes",priority FROM assessment_recommendations WHERE recall_attempt_id=$1`,[id]);
  return { ...row, id: row.id, conceptId: row.concept_id, canonicalQuestionRevisionId: row.canonical_question_revision_id ?? null, studySessionId: row.study_session_id, questionType: row.question_type, answer: row.answer, structuredAnswers: row.structured_answers ?? null, confidence: row.confidence, submittedAt: row.submitted_at, createdAt: row.created_at, startedAt: row.started_at, timeTakenSeconds: row.time_taken_seconds, selectedOptionId: row.selected_option_id, hintsUsed: row.hints_used, maxHintLevel: row.max_hint_level, hintTimestamps: row.hint_timestamps, repetitionReason: row.repetition_reason, remediationId: row.remediation_id, resultStatus: row.result_status, evidenceWeight: Number(row.evidence_weight ?? 1), question: question ? { id: question.id, canonicalQuestionRevisionId: question.canonical_question_revision_id ?? null, assessmentLevel: question.assessment_level, difficulty: question.difficulty, title: question.title, context: question.context, prompt: question.prompt, estimatedMinutes: question.estimated_minutes, source: question.source, options: question.options, correctOptionId: question.correct_option_id, explanation: question.explanation, knowledgePoints: question.knowledge_points, parts: question.question_parts ?? null, rubric: question.rubric ?? [], repetitionReason: row.repetition_reason, revealedHints: question.hints.slice(0, row.max_hint_level ?? 0), hintsRemaining: Math.max(0, question.hints.length - (row.max_hint_level ?? 0)) } : null, recommendation: recommendationResult.rows[0] ?? null, evaluation: await evaluationForAttempt(id) };
}
export async function getConcept(id: string, userId: string) { const result = await query<any>(`SELECT * FROM personal_concepts WHERE id=$1 AND user_id=$2`, [id,userId]); return result.rows[0] ? mapConcept(result.rows[0]) : null; }
  export async function getSessionByIdempotencyKey(userId: string, key: string) { const result = await query(`SELECT * FROM study_sessions WHERE user_id=$1 AND idempotency_key=$2`, [userId,key]); return result.rows[0] ? mapSession(result.rows[0]) : null; }
  export async function createSession(userId: string, input: any, idempotencyKey?: string, requestHash?: string) {
    return withTransaction(async (client) => {
      if (input.groundingSourceId) {
        const source = await client.query(`SELECT id FROM grounding_sources WHERE id=$1 AND user_id=$2 AND processing_status='processed' FOR KEY SHARE`, [input.groundingSourceId,userId]);
        if (!source.rows[0]) return idempotencyKey ? { session: null, created: false } : null;
      }
      if (!idempotencyKey) {
        const legacy = await client.query(`INSERT INTO study_sessions (user_id,title,raw_material,source_type,source_url,canonical_topic_id,canonical_concept_id,grounding_source_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [userId,input.title,input.rawMaterial ?? "",input.sourceType ?? "manual",input.sourceUrl ?? null,input.canonicalTopicId ?? null,input.canonicalConceptId ?? null,input.groundingSourceId ?? null]);
        return mapSession(legacy.rows[0]);
      }
      const result = await client.query(`INSERT INTO study_sessions (user_id,title,raw_material,source_type,source_url,canonical_topic_id,canonical_concept_id,grounding_source_id,idempotency_key,idempotency_request_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (user_id,idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING RETURNING *`, [userId,input.title,input.rawMaterial ?? "",input.sourceType ?? "manual",input.sourceUrl ?? null,input.canonicalTopicId ?? null,input.canonicalConceptId ?? null,input.groundingSourceId ?? null,idempotencyKey ?? null,requestHash ?? null]);
      if (result.rows[0]) return { session: mapSession(result.rows[0]), created: true };
      const existing = idempotencyKey ? await client.query(`SELECT * FROM study_sessions WHERE user_id=$1 AND idempotency_key=$2 FOR UPDATE`, [userId,idempotencyKey]) : null;
      if (!existing?.rows[0]) throw new Error("Study session insert returned no row");
      if (existing.rows[0].idempotency_request_hash !== requestHash) throw new AppError("This recovery key belongs to a different study request. Start a new study session to change its material.",409,"IDEMPOTENCY_KEY_REUSED");
      return { session: mapSession(existing.rows[0]), created: false };
    });
  }
export async function getSession(id: string, userId: string) { const result = await query(`SELECT * FROM study_sessions WHERE id=$1 AND user_id=$2`, [id,userId]); return result.rows[0] ? mapSession(result.rows[0]) : null; }
export async function completeSession(id: string, userId: string) { const result = await query(`UPDATE study_sessions SET status='completed',completed_at=COALESCE(completed_at,now()),updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING *`, [id,userId]); return result.rows[0] ? mapSession(result.rows[0]) : null; }
export async function createConcepts(userId: string, sessionId: string, concepts: any[]) { return withTransaction(async(client) => { await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`concept-extraction:${userId}:${sessionId}`]); const rows = []; for (const concept of concepts) { const existing=await client.query(`SELECT * FROM personal_concepts WHERE user_id=$1 AND study_session_id=$2 AND lower(regexp_replace(trim(name),'[[:space:]]+',' ','g'))=lower(regexp_replace(trim($3),'[[:space:]]+',' ','g')) ORDER BY created_at,id LIMIT 1`,[userId,sessionId,concept.name]); if(existing.rows[0]){rows.push(mapConcept(existing.rows[0]));continue;} const result = await client.query(`INSERT INTO personal_concepts (user_id,study_session_id,name,description,required_knowledge_points,difficulty,canonical_concept_id)
        SELECT $1,$2,$3,$4,$5,$6,CASE WHEN lower(regexp_replace(trim(cc.name),'[[:space:]]+',' ','g'))=lower(regexp_replace(trim($3),'[[:space:]]+',' ','g')) THEN cc.id END
        FROM study_sessions ss LEFT JOIN canonical_concepts cc ON cc.id=ss.canonical_concept_id
        WHERE ss.id=$2 AND ss.user_id=$1 RETURNING *`, [userId,sessionId,concept.name,concept.description,concept.requiredKnowledgePoints,concept.difficulty ?? 3]); rows.push(mapConcept(result.rows[0])); } return rows; }); }
export async function listConceptsForSession(sessionId: string, userId: string) { const result = await query(`SELECT * FROM personal_concepts WHERE study_session_id=$1 AND user_id=$2 ORDER BY created_at`, [sessionId,userId]); return result.rows.map(mapConcept); }
export async function updateConceptMastery(id: string, userId: string, coverage: number) { const result = await query(`UPDATE personal_concepts SET mastery=ROUND((mastery * 0.4 + $3 * 0.6)::numeric,4),updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING *`, [id,userId,coverage]); return result.rows[0] ? mapConcept(result.rows[0]) : null; }
export async function createAttempt(userId: string, sessionId: string, concept: any, questionType: string, question: string) { const existing = await query(`SELECT * FROM recall_attempts WHERE user_id=$1 AND concept_id=$2 AND submitted_at IS NULL ORDER BY created_at LIMIT 1`, [userId,concept.id]); if (existing.rows[0]) return getAttempt(existing.rows[0].id,userId); const result = await query(`INSERT INTO recall_attempts (user_id,concept_id,study_session_id,question_type,question) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [userId,concept.id,sessionId,questionType,question]); return getAttempt(result.rows[0].id,userId); }
export async function listPending(sessionId: string, userId: string) {
  const result=await query<any>(`SELECT r.*,to_jsonb(q) AS question_row,
      (SELECT jsonb_build_object('actionType',ar.action_type,'title',ar.title,'reason',ar.reason,'estimatedMinutes',ar.estimated_minutes,'priority',ar.priority) FROM assessment_recommendations ar WHERE ar.recall_attempt_id=r.id LIMIT 1) AS recommendation_row,
      CASE WHEN e.id IS NULL THEN NULL ELSE jsonb_build_object('overallCoverage',e.overall_coverage,'missingConcepts',e.missing_concepts,'mistakes',e.mistakes,'strengths',e.strengths,'feedback',e.feedback,'suggestedRecallType',e.suggested_recall_type,'evaluatorVersion',e.evaluator_version,
        'knowledgePointResults',COALESCE((SELECT jsonb_agg(jsonb_build_object('point',kpr.point,'status',kpr.status,'evidence',kpr.evidence,'feedback',kpr.feedback,'partId',kpr.part_id,'canonicalKnowledgePointId',kpr.canonical_knowledge_point_id) ORDER BY kpr.id) FROM recall_knowledge_point_results kpr WHERE kpr.evaluation_id=e.id),'[]'::jsonb)) END AS evaluation_row
    FROM recall_attempts r LEFT JOIN questions q ON q.id=r.question_id LEFT JOIN recall_evaluations e ON e.recall_attempt_id=r.id
    WHERE r.study_session_id=$1 AND r.user_id=$2 AND r.submitted_at IS NULL ORDER BY r.created_at,r.id`,[sessionId,userId]);
  return result.rows.map((row:any)=>{
    const questionRow=row.question_row;
    const question=questionRow?{id:questionRow.id,canonicalQuestionRevisionId:questionRow.canonical_question_revision_id??null,assessmentLevel:questionRow.assessment_level,difficulty:questionRow.difficulty,title:questionRow.title,context:questionRow.context,prompt:questionRow.prompt,estimatedMinutes:questionRow.estimated_minutes,source:questionRow.source,options:questionRow.options,correctOptionId:questionRow.correct_option_id,explanation:questionRow.explanation,knowledgePoints:questionRow.knowledge_points,parts:questionRow.question_parts??null,rubric:questionRow.rubric??[],repetitionReason:row.repetition_reason,revealedHints:(questionRow.hints??[]).slice(0,row.max_hint_level??0),hintsRemaining:Math.max(0,(questionRow.hints??[]).length-(row.max_hint_level??0))}:null;
    const evaluation=row.evaluation_row?{...row.evaluation_row,overallCoverage:Number(row.evaluation_row.overallCoverage)}:null;
    return {...row,id:row.id,conceptId:row.concept_id,canonicalQuestionRevisionId:row.canonical_question_revision_id??null,studySessionId:row.study_session_id,questionType:row.question_type,answer:row.answer??null,structuredAnswers:row.structured_answers??null,confidence:row.confidence,submittedAt:row.submitted_at,createdAt:row.created_at,startedAt:row.started_at,timeTakenSeconds:row.time_taken_seconds,selectedOptionId:row.selected_option_id,hintsUsed:row.hints_used,maxHintLevel:row.max_hint_level,hintTimestamps:row.hint_timestamps,repetitionReason:row.repetition_reason,remediationId:row.remediation_id,resultStatus:row.result_status,evidenceWeight:Number(row.evidence_weight??1),question,evaluation,recommendation:row.recommendation_row??null};
  });
}
export async function createInitialReview(userId: string, conceptId: string, difficulty: number) { await query(`INSERT INTO review_states (user_id,concept_id,state,due_at,difficulty) VALUES ($1,$2,'new',now(),$3) ON CONFLICT (user_id,concept_id) DO UPDATE SET due_at=LEAST(review_states.due_at,EXCLUDED.due_at),updated_at=now()`, [userId,conceptId,difficulty/5]); }
export async function getReview(userId: string, conceptId: string) { const result = await query(`SELECT * FROM review_states WHERE user_id=$1 AND concept_id=$2`, [userId,conceptId]); return mapReview(result.rows[0]); }
export async function revealNextHint(userId: string, attemptId: string) {
  const result = await query<any>(`UPDATE recall_attempts SET hints_used=hints_used+1,max_hint_level=max_hint_level+1,hint_timestamps=array_append(hint_timestamps,now()) WHERE id=$1 AND user_id=$2 AND submitted_at IS NULL AND max_hint_level < 3 AND max_hint_level < COALESCE((SELECT cardinality(q.hints) FROM questions q WHERE q.id=recall_attempts.question_id),0) RETURNING max_hint_level`, [attemptId,userId]);
  if (!result.rows[0]) return null;
  const hintResult = await query<any>(`SELECT q.hints[$2] AS hint FROM recall_attempts r JOIN questions q ON q.id=r.question_id WHERE r.id=$1 AND r.user_id=$3`, [attemptId,result.rows[0].max_hint_level,userId]);
  return { hint: hintResult.rows[0]?.hint ?? null, maxHintLevel: result.rows[0].max_hint_level };
}

export async function submitAttempt(userId: string, attemptId: string, answer: string, confidence: number, evaluation: any, conceptId: string, input: {
  selectedOptionId?: string | null;
  resultStatus: string;
  evidenceWeight: number;
  recommendation: any;
  structuredAnswers?: Array<{partId:string;answer:string}> | null;
  scheduleReview: (previous: ReviewStateSnapshot | null, currentMastery: number) => { scheduled: ReviewStateSnapshot; mastery: number };
}) {
  const written = await withTransaction(async (client) => {
    const conceptResult = await client.query<any>(`SELECT mastery FROM personal_concepts WHERE id=$1 AND user_id=$2 FOR UPDATE`, [conceptId,userId]);
    if (!conceptResult.rows[0]) return null;
    const reviewResult = await client.query<any>(`SELECT * FROM review_states WHERE user_id=$1 AND concept_id=$2 FOR UPDATE`, [userId,conceptId]);
    const previousRow = reviewResult.rows[0];
    const previous: ReviewStateSnapshot | null = previousRow ? {
      conceptId: previousRow.concept_id,
      state: previousRow.state,
      dueAt: previousRow.due_at,
      intervalDays: previousRow.interval_days,
      stability: Number(previousRow.stability),
      difficulty: Number(previousRow.difficulty),
      lastRecallAt: previousRow.last_recall_at,
      lastOutcome: previousRow.last_outcome,
      consecutiveSuccesses: previousRow.consecutive_successes,
      updatedAt: previousRow.updated_at,
    } : null;
    const { scheduled, mastery } = input.scheduleReview(previous, Number(conceptResult.rows[0].mastery));
    const result = await client.query(`UPDATE recall_attempts SET answer=$3,confidence=$4,selected_option_id=$5,submitted_at=now(),time_taken_seconds=GREATEST(0,FLOOR(EXTRACT(EPOCH FROM (now()-started_at)))::int),result_status=$6,evidence_weight=$7,structured_answers=$8 WHERE id=$1 AND user_id=$2 AND submitted_at IS NULL RETURNING id`, [attemptId,userId,answer,confidence,input.selectedOptionId ?? null,input.resultStatus,input.evidenceWeight,input.structuredAnswers ? JSON.stringify(input.structuredAnswers) : null]);
    if (!result.rows[0]) return null;
    await client.query(`UPDATE plan_tasks SET status='completed',updated_at=now() WHERE user_id=$1 AND recall_attempt_id=$2 AND status<>'completed'`, [userId,attemptId]);
    const evaluationResult = await client.query(`INSERT INTO recall_evaluations (recall_attempt_id,overall_coverage,missing_concepts,mistakes,strengths,feedback,suggested_recall_type,evaluator_version) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [attemptId,evaluation.overallCoverage,evaluation.missingConcepts,evaluation.mistakes,evaluation.strengths,evaluation.feedback,evaluation.suggestedRecallType,evaluation.evaluatorVersion]);
    for (const point of evaluation.knowledgePointResults) {
        const canonicalKnowledgePointId=await resolveCanonicalKnowledgePoint(client,attemptId,point.point);
        await client.query(`INSERT INTO recall_knowledge_point_results (evaluation_id,point,status,evidence,feedback,part_id,canonical_knowledge_point_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [evaluationResult.rows[0].id,point.point,point.status,point.evidence,point.feedback,point.partId ?? null,canonicalKnowledgePointId]);
      const score=({correct:1,partial:.5,missing:0} as Record<string,number>)[point.status] * input.evidenceWeight;
        await client.query(`INSERT INTO learner_knowledge_point_states(user_id,concept_id,point,mastery,attempt_count,last_status,canonical_knowledge_point_id) VALUES($1,$2,$3,$4,1,$5,$6) ON CONFLICT(user_id,concept_id,point) DO UPDATE SET mastery=ROUND((learner_knowledge_point_states.mastery*.4+EXCLUDED.mastery*.6)::numeric,3),attempt_count=learner_knowledge_point_states.attempt_count+1,last_status=EXCLUDED.last_status,canonical_knowledge_point_id=COALESCE(EXCLUDED.canonical_knowledge_point_id,learner_knowledge_point_states.canonical_knowledge_point_id),updated_at=now()`,[userId,conceptId,point.point,score,point.status,canonicalKnowledgePointId]);
    }
    const remediationResult=await client.query<any>(`SELECT a.remediation_id AS id,r.knowledge_point,r.trigger_score FROM recall_attempts a JOIN grounded_remediations r ON r.id=a.remediation_id WHERE a.id=$1`,[attemptId]);
    const remediation=remediationResult.rows[0];
    if(remediation){
      const resultForGap=evaluation.knowledgePointResults.find((point:any)=>point.point.trim().toLowerCase()===remediation.knowledge_point.trim().toLowerCase());
      const verifiedScore=resultForGap?Number((({correct:1,partial:.5,missing:0} as Record<string,number>)[resultForGap.status]??0)*input.evidenceWeight):0;
      const improved=verifiedScore>Number(remediation.trigger_score??0);
      await client.query(`UPDATE grounded_remediations SET status='verified',verification_score=$2,improved=$3,updated_at=now() WHERE id=$1`,[remediation.id,verifiedScore,improved]);
    }
    await client.query(`INSERT INTO assessment_recommendations(recall_attempt_id,action_type,title,reason,estimated_minutes,priority) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(recall_attempt_id) DO UPDATE SET action_type=EXCLUDED.action_type,title=EXCLUDED.title,reason=EXCLUDED.reason,estimated_minutes=EXCLUDED.estimated_minutes,priority=EXCLUDED.priority`,[attemptId,input.recommendation.actionType,input.recommendation.title,input.recommendation.reason,input.recommendation.estimatedMinutes,input.recommendation.priority]);
    const dim = evaluation.dimension ?? "explanation";
    await client.query(`INSERT INTO recall_dimension_results (recall_attempt_id,dimension,score) VALUES ($1,$2,$3) ON CONFLICT (recall_attempt_id,dimension) DO UPDATE SET score=EXCLUDED.score`, [attemptId,dim,Math.max(0,Math.min(1,evaluation.overallCoverage * input.evidenceWeight))]);
    await client.query(`UPDATE personal_concepts SET mastery=$3,updated_at=now() WHERE id=$1 AND user_id=$2`, [conceptId,userId,mastery]);
    await client.query(`INSERT INTO review_states (user_id,concept_id,state,due_at,interval_days,stability,difficulty,last_recall_at,last_outcome,consecutive_successes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (user_id,concept_id) DO UPDATE SET state=EXCLUDED.state,due_at=EXCLUDED.due_at,interval_days=EXCLUDED.interval_days,stability=EXCLUDED.stability,difficulty=EXCLUDED.difficulty,last_recall_at=EXCLUDED.last_recall_at,last_outcome=EXCLUDED.last_outcome,consecutive_successes=EXCLUDED.consecutive_successes,updated_at=now()`, [userId,conceptId,scheduled.state,scheduled.dueAt,scheduled.intervalDays,scheduled.stability,scheduled.difficulty,scheduled.lastRecallAt,scheduled.lastOutcome,scheduled.consecutiveSuccesses]);
    await client.query(`INSERT INTO learning_events (user_id,type,entity_type,entity_id,payload) VALUES ($1,'RECALL_SUBMITTED','RecallAttempt',$2,$3),($1,'EVALUATION_COMPLETED','RecallAttempt',$2,$4),($1,'REVIEW_SCHEDULED','ReviewState',$5,$6)`, [userId,attemptId,JSON.stringify({ confidence }),JSON.stringify({ mistakes: evaluation.mistakes }),conceptId,JSON.stringify({ dueAt: scheduled.dueAt, outcome: scheduled.lastOutcome })]);
    return true;
  });
  return written ? getAttempt(attemptId,userId) : null;
}

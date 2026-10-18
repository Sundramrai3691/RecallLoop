import { withTransaction, query, postgres } from "../../db/postgres.js";
import { getAttempt } from "../../repositories/legacyPostgresRepositories.js";
import { AppError, notFound } from "../../utils/errors.js";
import { assessmentBlueprint, buildQuestion, buildTargetedVerificationQuestion, upsertQuestion } from "./questionService.js";
import { findBuiltinMcq } from "./mcqBank.js";
import { chooseCanonicalQuestionSet,hasCanonicalQuestionBank,listEligibleCanonicalQuestions,materializeCanonicalQuestion } from "../questionBank/questionBankService.js";

export type AssessmentMode = "rapid_fire" | "deep_recall" | "mastery_check" | "practice";
const DIMENSIONS = ["recognition","recall","explanation","application","depth","transfer"];

const KNOWLEDGE_CHECK_BLUEPRINTS: Record<AssessmentMode, string[]> = {
  rapid_fire: ["mcq", "rapid_recall", "rapid_recall", "rapid_recall", "mcq"],
  deep_recall: ["descriptive"],
  mastery_check: ["mcq", "rapid_recall", "short_explanation", "scenario", "descriptive", "transfer"],
  practice: ["scenario"],
};

const ELIGIBLE_CANONICAL_QUESTIONS = `
  SELECT i.canonical_concept_id AS "conceptId", r.question_type AS "questionType", count(DISTINCT r.id)::int AS count
  FROM canonical_question_items i JOIN canonical_question_revisions r ON r.question_item_id=i.id
  WHERE r.revision=i.current_revision AND r.publication_status='published' AND r.review_status='subject_matter_reviewed' AND r.quality_status='valid'
    AND EXISTS (
      SELECT 1 FROM canonical_question_reviews approved
      JOIN canonical_question_reviewers reviewer ON reviewer.reviewer_user_id=approved.reviewer_user_id
      WHERE approved.question_revision_id=r.id AND approved.decision='approved' AND approved.content_hash=r.content_hash
        AND approved.reviewed_at>=reviewer.granted_at
        AND (reviewer.revoked_at IS NULL OR approved.reviewed_at<reviewer.revoked_at)
        AND NOT EXISTS (SELECT 1 FROM canonical_question_reviews later WHERE later.question_revision_id=r.id AND (later.reviewed_at,later.id)>(approved.reviewed_at,approved.id))
    )
  GROUP BY i.canonical_concept_id,r.question_type`;

function supportedModes(counts: Record<string, number>) {
  return Object.entries(KNOWLEDGE_CHECK_BLUEPRINTS).filter(([, blueprint]) => {
    const required = new Map<string, number>();
    for (const type of blueprint) required.set(type, (required.get(type) ?? 0) + 1);
    return [...required].every(([type, count]) => (counts[type] ?? 0) >= count);
  }).map(([mode]) => mode as AssessmentMode);
}

export async function listKnowledgeCheckCoverage() {
  const result = await query<any>(`
    SELECT d.name AS "domainName", s.id AS "skillId", s.name AS "skillName", s.description AS "skillDescription",
      t.id AS "topicId", t.name AS "topicName", t.description AS "topicDescription",
      c.id AS "conceptId", c.name AS "conceptName", c.description AS "conceptDescription",
      COALESCE((SELECT jsonb_object_agg(eligible."questionType", eligible.count)
        FROM (${ELIGIBLE_CANONICAL_QUESTIONS}) eligible WHERE eligible."conceptId"=c.id), '{}'::jsonb) AS coverage
    FROM canonical_concepts c JOIN topics t ON t.id=c.topic_id JOIN canonical_skills s ON s.id=t.skill_id
    JOIN role_skills rs ON rs.skill_id=s.id JOIN roles r ON r.id=rs.role_id JOIN knowledge_domains d ON d.id=r.domain_id
    WHERE c.status='active'
    GROUP BY d.name,s.id,t.id,c.id ORDER BY d.name,s.name,t.name,c.name`);
  const subjects = new Map<string, any>();
  for (const row of result.rows) {
    const subjectId = `${row.domainName}:${row.skillId}`;
    if (!subjects.has(subjectId)) subjects.set(subjectId, { id: row.skillId, domainName: row.domainName, name: row.skillName, description: row.skillDescription, topics: [] });
    const subject = subjects.get(subjectId);
    let topic = subject.topics.find((item: any) => item.id === row.topicId);
    if (!topic) { topic = { id: row.topicId, name: row.topicName, description: row.topicDescription, concepts: [] }; subject.topics.push(topic); }
    const coverage = Object.fromEntries(Object.entries(row.coverage ?? {}).map(([type, count]) => [type, Number(count)]));
    topic.concepts.push({ id: row.conceptId, name: row.conceptName, description: row.conceptDescription, coverage, supportedModes: supportedModes(coverage) });
  }
  return [...subjects.values()];
}

export async function createCanonicalKnowledgeCheck(userId: string, canonicalConceptId: string, mode: AssessmentMode) {
  if (typeof canonicalConceptId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(canonicalConceptId)) throw new AppError("A valid canonical concept ID is required.",400,"VALIDATION_ERROR");
  return createAssessmentForSource(userId, null, canonicalConceptId, mode);
}

export async function createAssessment(userId: string, conceptId: string, mode: AssessmentMode) {
  return createAssessmentForSource(userId, conceptId, null, mode);
}

async function createAssessmentForSource(userId: string, ownedConceptId: string | null, canonicalConceptId: string | null, mode: AssessmentMode) {
  if (!new Set(["rapid_fire","deep_recall","mastery_check","practice"]).has(mode)) throw new AppError("Invalid assessment mode",400,"VALIDATION_ERROR");
  const attempts = await withTransaction(async (client) => {
    let concept: any;
    let conceptId = ownedConceptId;
    if (canonicalConceptId) {
      const canonicalResult = await client.query<any>(`SELECT c.id,c.name,c.description,c.difficulty,c.topic_id AS "topicId",
          COALESCE(array_agg(kp.statement ORDER BY kp.importance DESC,kp.id) FILTER (WHERE kp.id IS NOT NULL),'{}') AS points
        FROM canonical_concepts c LEFT JOIN knowledge_points kp ON kp.concept_id=c.id
        WHERE c.id=$1 AND c.status='active' GROUP BY c.id`, [canonicalConceptId]);
      const canonical = canonicalResult.rows[0];
      if (!canonical) throw notFound("Canonical concept not found", "CANONICAL_CONCEPT_NOT_FOUND");
      const eligible = await client.query<any>(`${ELIGIBLE_CANONICAL_QUESTIONS} HAVING i.canonical_concept_id=$1`, [canonicalConceptId]);
      const counts = Object.fromEntries(eligible.rows.map((row: any) => [row.questionType, Number(row.count)]));
      if (!supportedModes(counts).includes(mode)) throw new AppError("Approved question coverage is not sufficient for this assessment. Choose a supported mode or learn this topic first.",409,"QUESTION_BANK_COVERAGE_INSUFFICIENT");
      const study = await client.query<any>(`INSERT INTO study_sessions(user_id,title,raw_material,source_type,status,completed_at,canonical_topic_id,canonical_concept_id)
        VALUES($1,$2,'','manual','completed',now(),$3,$4) RETURNING id`, [userId,`Knowledge check: ${canonical.name}`,canonical.topicId,canonical.id]);
      const personal = await client.query<any>(`INSERT INTO personal_concepts(user_id,study_session_id,name,description,required_knowledge_points,difficulty,canonical_concept_id)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [userId,study.rows[0].id,canonical.name,canonical.description,canonical.points,canonical.difficulty,canonical.id]);
      concept = personal.rows[0]; conceptId = concept.id;
    } else {
      const result = await client.query<any>(`SELECT * FROM personal_concepts WHERE id=$1 AND user_id=$2`,[ownedConceptId,userId]);
      concept = result.rows[0];
      if (!concept) throw notFound("Concept not found","MISSING_CONCEPT");
    }
    if (!conceptId) throw new AppError("Assessment concept could not be resolved.",500,"ASSESSMENT_CONCEPT_MISSING");
    const attemptIds: string[] = [];
    const blueprint = assessmentBlueprint(mode);
    const history=await client.query<any>(`SELECT question_id,canonical_question_revision_id FROM recall_attempts WHERE user_id=$1 AND concept_id=$2 ORDER BY created_at DESC LIMIT 20`,[userId,conceptId]);
    const recentIds=new Set<string>(history.rows.map((row)=>row.question_id).filter(Boolean));
    const recentRevisionIds=new Set<string>(history.rows.map((row)=>row.canonical_question_revision_id).filter(Boolean));
    const review=await client.query<any>(`SELECT due_at<=now() AS due FROM review_states WHERE user_id=$1 AND concept_id=$2`,[userId,conceptId]);
    const failures=await client.query<any>(`SELECT count(*)::int AS count FROM (SELECT e.overall_coverage FROM recall_attempts r JOIN recall_evaluations e ON e.recall_attempt_id=r.id WHERE r.user_id=$1 AND r.concept_id=$2 ORDER BY r.submitted_at DESC LIMIT 3) recent WHERE overall_coverage<.55`,[userId,conceptId]);
    const useCanonicalBank=Boolean(concept.canonical_concept_id)&&await hasCanonicalQuestionBank(client,concept.canonical_concept_id);
    const bankQuestions=useCanonicalBank?chooseCanonicalQuestionSet({candidates:await listEligibleCanonicalQuestions(client,concept.canonical_concept_id),blueprint,targetDifficulty:Math.max(1,Math.min(5,Number(concept.difficulty))),recentRevisionIds}):null;
    const session = await client.query<any>(`INSERT INTO assessment_sessions(user_id,concept_id,mode) VALUES($1,$2,$3) RETURNING id`,[userId,conceptId,mode]);
    for (let index=0; index<blueprint.length; index++) {
        let type=blueprint[index];
        let draft;
        let questionId:string;
        let revisionId:string|null=null;
        let repeated:boolean;
        if(bankQuestions){
          const selected=bankQuestions[index];
          const candidate=selected.candidate;
          revisionId=candidate.revisionId;
          questionId=await materializeCanonicalQuestion(client,conceptId,candidate);
          type=candidate.questionType;
          draft={questionType:candidate.questionType,assessmentLevel:candidate.assessmentLevel,difficulty:candidate.difficulty,title:candidate.title,context:candidate.context,prompt:candidate.prompt,estimatedMinutes:candidate.estimatedMinutes,source:"builtin" as const,options:candidate.options,correctOptionId:candidate.correctOptionId,explanation:candidate.explanation,knowledgePoints:candidate.knowledgePoints,parts:null,hints:candidate.hints};
          repeated=selected.repeated;
        }else{
          const target=concept.required_knowledge_points[index % Math.max(1,concept.required_knowledge_points.length)];
          type=blueprint[index]==="mcq"&&!findBuiltinMcq(concept.name,target??"",index)?"rapid_recall":blueprint[index];
          draft=buildQuestion(concept.name,type,concept.required_knowledge_points,Math.min(5,Number(concept.difficulty)),index,0);
          questionId=await upsertQuestion(client,conceptId,draft);
          for(let variant=1;recentIds.has(questionId)&&variant<8;variant++){draft=buildQuestion(concept.name,type,concept.required_knowledge_points,Math.min(5,Number(concept.difficulty)),index+variant,variant);questionId=await upsertQuestion(client,conceptId,draft);}
          repeated=recentIds.has(questionId);
        }
        const repetitionReason=repeated?(Number(failures.rows[0]?.count)>=2?"remediation":mode==="mastery_check"||Number(concept.mastery)>=.75?"mastery_confirmation":review.rows[0]?.due?"spaced_recall":null):null;
        const attempt = await client.query<any>(`INSERT INTO recall_attempts(user_id,concept_id,study_session_id,question_type,question,question_id,assessment_session_id,assessment_position,repetition_reason,canonical_question_revision_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,[userId,conceptId,concept.study_session_id,draft.questionType,draft.prompt,questionId,session.rows[0].id,index+1,repetitionReason,revisionId]);
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
    const result=await client.query<any>(`SELECT r.id,r.user_id,r.concept_id,r.knowledge_point,r.status,r.verification_attempt_id,c.name,c.study_session_id,c.difficulty,c.canonical_concept_id
      FROM grounded_remediations r JOIN personal_concepts c ON c.id=r.concept_id AND c.user_id=r.user_id WHERE r.id=$1 AND r.user_id=$2 FOR UPDATE OF r`,[remediationId,userId]);
    const remediation=result.rows[0];
    if(!remediation)throw notFound("Remediation not found","REMEDIATION_NOT_FOUND");
    if(remediation.verification_attempt_id)return remediation.verification_attempt_id as string;
    if(remediation.status!=="ready")throw new AppError("Remediation is not ready for verification",409,"REMEDIATION_NOT_READY");
    const history=await client.query<any>(`SELECT question_id,canonical_question_revision_id FROM recall_attempts WHERE user_id=$1 AND concept_id=$2 ORDER BY created_at DESC LIMIT 20`,[userId,remediation.concept_id]);
    const recentIds=new Set<string>(history.rows.map((row)=>row.question_id));
    const recentRevisionIds=new Set<string>(history.rows.map((row)=>row.canonical_question_revision_id).filter(Boolean));
    let bankCandidate: Awaited<ReturnType<typeof listEligibleCanonicalQuestions>>[number] | null=null;
    if(remediation.canonical_concept_id){
      const candidates=await listEligibleCanonicalQuestions(client,remediation.canonical_concept_id);
      bankCandidate=candidates.filter((candidate)=>!recentRevisionIds.has(candidate.revisionId)&&candidate.questionType!=="mcq"&&candidate.knowledgePoints.some((point)=>point.trim().toLowerCase()===String(remediation.knowledge_point).trim().toLowerCase()))
        .sort((left,right)=>left.difficulty-right.difficulty||left.itemSlug.localeCompare(right.itemSlug))[0]??null;
    }
    let draft=buildTargetedVerificationQuestion(remediation.name,remediation.knowledge_point,0);
    let questionId="";
    let revisionId:string|null=null;
    if(bankCandidate){
      revisionId=bankCandidate.revisionId;
      questionId=await materializeCanonicalQuestion(client,remediation.concept_id,bankCandidate);
      draft={questionType:bankCandidate.questionType,assessmentLevel:bankCandidate.assessmentLevel,difficulty:bankCandidate.difficulty,title:bankCandidate.title,context:bankCandidate.context,prompt:bankCandidate.prompt,estimatedMinutes:bankCandidate.estimatedMinutes,source:"builtin",options:bankCandidate.options,correctOptionId:bankCandidate.correctOptionId,explanation:bankCandidate.explanation,knowledgePoints:bankCandidate.knowledgePoints,parts:null,hints:bankCandidate.hints};
    }else{
      for(let variant=0;variant<6;variant++){
        draft=buildTargetedVerificationQuestion(remediation.name,remediation.knowledge_point,variant);
        questionId=await upsertQuestion(client,remediation.concept_id,draft);
        if(!recentIds.has(questionId))break;
        questionId="";
      }
    }
    if(!questionId)throw new AppError("No unseen targeted verification wording is available yet",409,"NO_FRESH_VERIFICATION");
    const session=await client.query<any>(`INSERT INTO assessment_sessions(user_id,concept_id,mode) VALUES($1,$2,'practice') RETURNING id`,[userId,remediation.concept_id]);
    const attempt=await client.query<any>(`INSERT INTO recall_attempts(user_id,concept_id,study_session_id,question_type,question,question_id,assessment_session_id,assessment_position,remediation_id,canonical_question_revision_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,1,$8,$9) RETURNING id`,[userId,remediation.concept_id,remediation.study_session_id,draft.questionType,draft.prompt,questionId,session.rows[0].id,remediationId,revisionId]);
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
  const conceptResult = await query<any>(`SELECT name, required_knowledge_points, mastery,canonical_concept_id FROM personal_concepts WHERE id=$1 AND user_id=$2`,[session.concept_id,userId]);
  const conceptRow = conceptResult.rows[0];
  const rows = await query<any>(`SELECT id,assessment_position,submitted_at FROM recall_attempts WHERE assessment_session_id=$1 ORDER BY assessment_position`,[assessmentId]);
  const questions=[];
  for (const row of rows.rows) questions.push(await getAttempt(row.id,userId));
  const complete = questions.length > 0 && questions.every((item:any) => Boolean(item?.submittedAt));
  if (complete && !session.completed_at) await query(`UPDATE assessment_sessions SET completed_at=now() WHERE id=$1`,[assessmentId]);
  const dimensions = await query<any>(`SELECT d.dimension,AVG(d.score)::float AS score FROM recall_dimension_results d JOIN recall_attempts r ON r.id=d.recall_attempt_id WHERE r.assessment_session_id=$1 GROUP BY d.dimension`,[assessmentId]);
  const recommendationResult=complete?await query<any>(`SELECT rec.action_type AS "actionType",rec.title,rec.reason,rec.estimated_minutes AS "estimatedMinutes",rec.priority FROM recall_attempts r JOIN assessment_recommendations rec ON rec.recall_attempt_id=r.id WHERE r.assessment_session_id=$1 ORDER BY rec.priority DESC,r.assessment_position LIMIT 1`,[assessmentId]):{rows:[]};
  let recommendation=recommendationResult.rows[0]??null;
  if (recommendation && conceptRow?.canonical_concept_id) {
    const modeForAction: Record<string, AssessmentMode> = { recall: "rapid_fire", practice: "practice", mastery_check: "mastery_check", remediation: "deep_recall" };
    const mode = modeForAction[recommendation.actionType];
    if (mode) {
      const client = await postgres.connect();
      try {
        const eligible = await listEligibleCanonicalQuestions(client,conceptRow.canonical_concept_id);
        const recent = await client.query<any>(`SELECT canonical_question_revision_id FROM recall_attempts WHERE user_id=$1 AND concept_id=$2 AND canonical_question_revision_id IS NOT NULL ORDER BY created_at DESC LIMIT 20`,[userId,session.concept_id]);
        const recentIds = new Set<string>(recent.rows.map((row:any)=>row.canonical_question_revision_id));
        const freshCounts = eligible.filter((candidate)=>!recentIds.has(candidate.revisionId)).reduce((counts:Record<string,number>,candidate)=>{counts[candidate.questionType]=(counts[candidate.questionType]??0)+1;return counts;},{});
        const blueprint = assessmentBlueprint(mode);
        const canVerify = blueprint.every((type)=>freshCounts[type]>=blueprint.filter((required)=>required===type).length);
        if (!canVerify) recommendation = { actionType:"learn",title:`Review focused resources Â· ${conceptRow.name}`,reason:`Your result points to another review of this concept, but its exact approved bank does not have enough unseen questions for that check yet. Review the mapped resources before trying again.`,estimatedMinutes:12,priority:recommendation.priority };
      } finally { client.release(); }
    }
  }
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
      recommendation
    } : null
  };
}

import type { PoolClient } from "pg";
import { createHash } from "node:crypto";
import { withTransaction, query } from "../../db/postgres.js";
import { AppError, conflict, notFound } from "../../utils/errors.js";
import { getAttempt, getConcept } from "../../repositories/legacyPostgresRepositories.js";
import { serializeAttempt, serializeConcept } from "../../lib/serialize.js";
import { CANONICAL_QUESTION_REVIEW_ELIGIBILITY_SQL, listEligibleCanonicalQuestions, materializeCanonicalQuestion, type CanonicalQuestionCandidate } from "../questionBank/questionBankService.js";
import { createGroundedRemediation, createVerification } from "../grounding/groundedRemediationService.js";

export type RecallSprintStatus = "in_progress" | "completed" | "abandoned";
export type RecallSprintItemSource = "due" | "weak" | "recent";

export interface RecallSprintItem {
  id: string;
  position: number;
  source: RecallSprintItemSource;
  reason: string;
  conceptId: string;
  conceptName: string;
  recallAttemptId: string;
  submitted: boolean;
  recall: ReturnType<typeof serializeAttempt>;
  concept: ReturnType<typeof serializeConcept>;
}

export interface RecallSprint {
  id: string;
  status: RecallSprintStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  abandonedAt: string | null;
  repairRemediationId: string | null;
  verificationAttemptId: string | null;
  items: RecallSprintItem[];
  progress: { submitted: number; total: number };
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function candidatePriority(candidate: CanonicalQuestionCandidate): number {
  const priorities: Record<string, number> = {
    rapid_recall: 0,
    short_explanation: 1,
    descriptive: 2,
    application: 3,
    scenario: 4,
    comparison: 5,
    transfer: 6,
    mcq: 7,
  };
  return priorities[candidate.questionType] ?? 8;
}

export function chooseSprintCandidate(
  candidates: CanonicalQuestionCandidate[],
  recentRevisionIds: Set<string>,
  weakKnowledgePoints: string[] = [],
): CanonicalQuestionCandidate | null {
  const weak = new Set(weakKnowledgePoints.map((point) => point.trim().toLocaleLowerCase()));
  return [...candidates]
    .filter((candidate) => candidate.questionType !== "coding")
    .sort((left, right) => {
      const leftRecent = recentRevisionIds.has(left.revisionId) ? 1 : 0;
      const rightRecent = recentRevisionIds.has(right.revisionId) ? 1 : 0;
      const leftWeak = left.knowledgePoints.some((point) => weak.has(point.trim().toLocaleLowerCase())) ? 0 : 1;
      const rightWeak = right.knowledgePoints.some((point) => weak.has(point.trim().toLocaleLowerCase())) ? 0 : 1;
      return leftRecent - rightRecent
        || leftWeak - rightWeak
        || candidatePriority(left) - candidatePriority(right)
        || left.itemSlug.localeCompare(right.itemSlug);
    })[0] ?? null;
}

async function createCanonicalRecallItem(
  client: PoolClient,
  userId: string,
  canonicalConceptId: string,
  source: RecallSprintItemSource,
  reason: string,
  weakKnowledgePoints: string[] = [],
): Promise<{ conceptId: string; recallAttemptId: string }> {
  let conceptResult = await client.query<any>(
    `SELECT pc.* FROM personal_concepts pc
     WHERE pc.user_id=$1 AND pc.canonical_concept_id=$2
     ORDER BY pc.created_at,pc.id LIMIT 1`,
    [userId, canonicalConceptId],
  );
  let concept = conceptResult.rows[0];
  if (!concept) {
    const canonical = await client.query<any>(`SELECT c.id,c.name,c.description,c.difficulty,c.topic_id AS "topicId",
        COALESCE(array_agg(kp.statement ORDER BY kp.importance DESC,kp.id) FILTER (WHERE kp.id IS NOT NULL),'{}') AS points
      FROM canonical_concepts c LEFT JOIN knowledge_points kp ON kp.concept_id=c.id
      WHERE c.id=$1 AND c.status='active' GROUP BY c.id`, [canonicalConceptId]);
    if (!canonical.rows[0]) throw notFound("Canonical concept not found", "CANONICAL_CONCEPT_NOT_FOUND");
    const row = canonical.rows[0];
    const session = await client.query<any>(`INSERT INTO study_sessions
      (user_id,title,raw_material,source_type,status,completed_at,canonical_topic_id,canonical_concept_id)
      VALUES($1,$2,'','manual','completed',now(),$3,$4) RETURNING id`,
      [userId, `Recall Sprint: ${row.name}`, row.topicId, row.id]);
    const personal = await client.query<any>(`INSERT INTO personal_concepts
      (user_id,study_session_id,name,description,required_knowledge_points,difficulty,canonical_concept_id)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [userId, session.rows[0].id, row.name, row.description, row.points, row.difficulty, row.id]);
    concept = personal.rows[0];
  }

  const candidates = await listEligibleCanonicalQuestions(client, canonicalConceptId);
  const history = await client.query<any>(`SELECT canonical_question_revision_id
    FROM recall_attempts r JOIN personal_concepts pc ON pc.id=r.concept_id
    WHERE r.user_id=$1 AND pc.canonical_concept_id=$2
    ORDER BY r.created_at DESC,r.id DESC LIMIT 100`,
    [userId, canonicalConceptId]);
  const recentRevisionIds = new Set<string>(history.rows.map((row) => row.canonical_question_revision_id).filter(Boolean));
  const candidate = chooseSprintCandidate(candidates, recentRevisionIds, weakKnowledgePoints);
  if (!candidate) throw conflict("No eligible unseen canonical question is available for this Sprint item", "SPRINT_ITEM_NOT_AVAILABLE");

  const questionId = await materializeCanonicalQuestion(client, concept.id, candidate);
  const attempt = await client.query<any>(`INSERT INTO recall_attempts
    (user_id,concept_id,study_session_id,question_type,question,question_id,canonical_question_revision_id,repetition_reason)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [
      userId,
      concept.id,
      concept.study_session_id,
      candidate.questionType,
      candidate.prompt,
      questionId,
      candidate.revisionId,
      source === "weak" ? "remediation" : source === "due" ? "spaced_recall" : null,
    ]);
  await client.query(`INSERT INTO learning_events
    (user_id,type,entity_type,entity_id,payload)
    VALUES($1,'SPRINT_ITEM_CREATED','RecallAttempt',$2,$3)`,
    [userId, attempt.rows[0].id, JSON.stringify({ source, reason })]);
  return { conceptId: concept.id, recallAttemptId: attempt.rows[0].id };
}

async function getSprintRow(userId: string, sprintId: string): Promise<RecallSprint> {
  const sprintResult = await query<any>(`SELECT * FROM recall_sprints WHERE id=$1 AND user_id=$2`, [sprintId, userId]);
  const sprint = sprintResult.rows[0];
  if (!sprint) throw notFound("Recall Sprint not found", "SPRINT_NOT_FOUND");
  const itemsResult = await query<any>(`SELECT si.*,pc.name AS "conceptName"
    FROM recall_sprint_items si JOIN personal_concepts pc ON pc.id=si.concept_id AND pc.user_id=$2
    WHERE si.sprint_id=$1 ORDER BY si.position`, [sprintId, userId]);
  const items: RecallSprintItem[] = [];
  for (const row of itemsResult.rows) {
    const attempt = await getAttempt(row.recall_attempt_id, userId);
    const concept = await getConcept(row.concept_id, userId);
    if (!attempt || !concept) continue;
    items.push({
      id: row.id,
      position: Number(row.position),
      source: row.source,
      reason: row.reason,
      conceptId: row.concept_id,
      conceptName: row.conceptName,
      recallAttemptId: row.recall_attempt_id,
      submitted: Boolean(attempt.submittedAt),
      recall: serializeAttempt(attempt),
      concept: serializeConcept(concept),
    });
  }
  const submitted = items.filter((item) => item.submitted).length;
  return {
    id: sprint.id,
    status: sprint.status,
    createdAt: sprint.created_at,
    updatedAt: sprint.updated_at,
    completedAt: sprint.completed_at,
    abandonedAt: sprint.abandoned_at,
    repairRemediationId: sprint.repair_remediation_id,
    verificationAttemptId: sprint.verification_attempt_id,
    items,
    progress: { submitted, total: items.length },
  };
}

export async function getActiveSprint(userId: string): Promise<RecallSprint | null> {
  const result = await query<{ id: string }>(`SELECT id FROM recall_sprints WHERE user_id=$1 AND status='in_progress' ORDER BY created_at DESC LIMIT 1`, [userId]);
  return result.rows[0] ? getSprintRow(userId, result.rows[0].id) : null;
}

export async function getSprint(userId: string, sprintId: string): Promise<RecallSprint> {
  return getSprintRow(userId, sprintId);
}

export async function startSprint(userId: string, idempotencyKey: string, requestHashInput?: string): Promise<RecallSprint> {
  if (!isUuid(idempotencyKey)) throw new AppError("A valid Sprint idempotency key is required.", 400, "VALIDATION_ERROR");
  const requestHash=requestHashInput?.trim() || createHash("sha256").update(JSON.stringify({operation:"start-recall-sprint"})).digest("hex");

  return withTransaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [`recall-sprint:${userId}`]);
    const existingKey = await client.query<any>(`SELECT id,idempotency_request_hash FROM recall_sprints WHERE user_id=$1 AND idempotency_key=$2`, [userId, idempotencyKey]);
    if (existingKey.rows[0]) {
      const existingHash=existingKey.rows[0].idempotency_request_hash as string;
      if(existingHash && existingHash!==requestHash)throw conflict("This Sprint idempotency key was already used for a different request.","SPRINT_IDEMPOTENCY_REUSED");
      if(!existingHash)await client.query(`UPDATE recall_sprints SET idempotency_request_hash=$2,updated_at=now() WHERE id=$1`,[existingKey.rows[0].id,requestHash]);
      return existingKey.rows[0].id;
    }

    const active = await client.query<any>(`SELECT id FROM recall_sprints WHERE user_id=$1 AND status='in_progress' LIMIT 1`, [userId]);
    if (active.rows[0]) return active.rows[0].id;

    const eligibleDue = await client.query<any>(`
      SELECT r.id AS "recallId",r.concept_id AS "conceptId",c.name AS "conceptName",rs.due_at AS "dueAt",
        r.canonical_question_revision_id AS "revisionId"
      FROM recall_attempts r
      JOIN personal_concepts c ON c.id=r.concept_id AND c.user_id=r.user_id
      JOIN review_states rs ON rs.user_id=r.user_id AND rs.concept_id=r.concept_id
      WHERE r.user_id=$1 AND r.submitted_at IS NULL AND rs.due_at<=now()
        AND (
          r.canonical_question_revision_id IS NULL
          OR EXISTS (
            SELECT 1 FROM canonical_question_revisions rq
            JOIN canonical_question_items qi ON qi.id=rq.question_item_id
            WHERE rq.id=r.canonical_question_revision_id
              AND rq.revision=qi.current_revision
              AND rq.publication_status='published'
              AND rq.review_status IN ('subject_matter_reviewed','automated_reviewed')
              AND rq.quality_status='valid'
              AND ${CANONICAL_QUESTION_REVIEW_ELIGIBILITY_SQL.replace(/\br\b/g, "rq")}
          )
        )
      ORDER BY rs.due_at,r.created_at,r.id LIMIT 2`,
      [userId]);

    const selectedConceptIds = new Set<string>();
    const selectedAttemptIds = new Set<string>();
    const itemSpecs: Array<{ source: RecallSprintItemSource; reason: string; conceptId: string; recallAttemptId: string }> = [];

    for (const due of eligibleDue.rows) {
      if (selectedConceptIds.has(due.conceptId) || selectedAttemptIds.has(due.recallId)) continue;
      selectedConceptIds.add(due.conceptId);
      selectedAttemptIds.add(due.recallId);
      itemSpecs.push({
        source: "due",
        reason: "This recall is due according to the existing review schedule.",
        conceptId: due.conceptId,
        recallAttemptId: due.recallId,
      });
      if (itemSpecs.length >= 3) break;
    }

    if (itemSpecs.length < 3) {
      const weak = await client.query<any>(`SELECT c.id,c.name,c.mastery,c.canonical_concept_id,
          COALESCE((SELECT jsonb_agg(kp.point) FROM learner_knowledge_point_states kp WHERE kp.user_id=c.user_id AND kp.concept_id=c.id AND kp.last_status IN ('partial','missing')),'[]'::jsonb) AS weak_points
        FROM personal_concepts c
        WHERE c.user_id=$1 AND c.canonical_concept_id IS NOT NULL AND c.mastery<0.7
          AND EXISTS(SELECT 1 FROM recall_attempts r WHERE r.user_id=c.user_id AND r.concept_id=c.id AND r.submitted_at IS NOT NULL)
        ORDER BY c.mastery,c.updated_at DESC,c.id LIMIT 10`,
        [userId]);
      for (const row of weak.rows) {
        if (itemSpecs.length >= 3 || selectedConceptIds.has(row.id)) continue;
        const weakPoints = Array.isArray(row.weak_points) ? row.weak_points.map(String) : [];
        try {
          const created = await createCanonicalRecallItem(client, userId, row.canonical_concept_id, "weak", "This is the lowest-evidence recently assessed concept available in an eligible Sprint position.", weakPoints);
          selectedConceptIds.add(created.conceptId);
          selectedAttemptIds.add(created.recallAttemptId);
          itemSpecs.push({ source: "weak", reason: "Submitted recall evidence marks this concept as weak.", conceptId: created.conceptId, recallAttemptId: created.recallAttemptId });
        } catch (error) {
          if (error instanceof AppError && ["SPRINT_ITEM_NOT_AVAILABLE","CANONICAL_CONCEPT_NOT_FOUND"].includes(error.code)) continue;
          throw error;
        }
      }
    }

    if (itemSpecs.length < 3) {
      const recent = await client.query<any>(`SELECT c.id,c.name,c.canonical_concept_id,c.updated_at
        FROM personal_concepts c JOIN study_sessions ss ON ss.id=c.study_session_id
        WHERE c.user_id=$1 AND c.canonical_concept_id IS NOT NULL
        ORDER BY c.updated_at DESC,c.id LIMIT 10`,
        [userId]);
      for (const row of recent.rows) {
        if (itemSpecs.length >= 3 || selectedConceptIds.has(row.id)) continue;
        try {
          const created = await createCanonicalRecallItem(client, userId, row.canonical_concept_id, "recent", "This concept was studied recently and has room in the bounded Sprint.");
          selectedConceptIds.add(created.conceptId);
          selectedAttemptIds.add(created.recallAttemptId);
          itemSpecs.push({ source: "recent", reason: "This recently studied concept is included because the Sprint has remaining capacity.", conceptId: created.conceptId, recallAttemptId: created.recallAttemptId });
        } catch (error) {
          if (error instanceof AppError && ["SPRINT_ITEM_NOT_AVAILABLE","CANONICAL_CONCEPT_NOT_FOUND"].includes(error.code)) continue;
          throw error;
        }
      }
    }

    if (!itemSpecs.length) throw conflict("No supported, eligible work is available for a Recall Sprint.", "SPRINT_NO_ELIGIBLE_WORK");

    const sprint = await client.query<any>(`INSERT INTO recall_sprints
      (user_id,status,idempotency_key,idempotency_request_hash) VALUES($1,'in_progress',$2,$3) RETURNING *`,
      [userId, idempotencyKey, requestHash]);
    for (let index = 0; index < itemSpecs.length; index++) {
      const item = itemSpecs[index];
      await client.query(`INSERT INTO recall_sprint_items
        (sprint_id,position,source,concept_id,recall_attempt_id,reason)
        VALUES($1,$2,$3,$4,$5,$6)`,
        [sprint.rows[0].id, index + 1, item.source, item.conceptId, item.recallAttemptId, item.reason]);
    }
    await client.query(`INSERT INTO learning_events
      (user_id,type,entity_type,entity_id,payload)
      VALUES($1,'SPRINT_STARTED','RecallSprint',$2,$3)`,
      [userId, sprint.rows[0].id, JSON.stringify({ itemCount: itemSpecs.length, sources: itemSpecs.map((item) => item.source) })]);
    return sprint.rows[0].id;
  }).then((sprintId) => getSprintRow(userId, sprintId));
}

export async function completeSprint(userId: string, sprintId: string): Promise<RecallSprint> {
  return withTransaction(async (client) => {
    const sprint = await client.query<any>(`SELECT * FROM recall_sprints WHERE id=$1 AND user_id=$2 FOR UPDATE`, [sprintId, userId]);
    if (!sprint.rows[0]) throw notFound("Recall Sprint not found", "SPRINT_NOT_FOUND");
    if (sprint.rows[0].status !== "in_progress") return sprintId;
    const pending = await client.query<{ count: string }>(`SELECT count(*)::text AS count
      FROM recall_sprint_items si JOIN recall_attempts r ON r.id=si.recall_attempt_id
      WHERE si.sprint_id=$1 AND r.user_id=$2 AND r.submitted_at IS NULL`,
      [sprintId, userId]);
    if (Number(pending.rows[0].count) > 0) throw conflict("Every Sprint question must be submitted or skipped before completion.", "SPRINT_INCOMPLETE");
    await client.query(`UPDATE recall_sprints SET status='completed',completed_at=now(),updated_at=now() WHERE id=$1`, [sprintId]);
    await client.query(`INSERT INTO learning_events
      (user_id,type,entity_type,entity_id,payload)
      VALUES($1,'SPRINT_COMPLETED','RecallSprint',$2,'{}'::jsonb)`,
      [userId, sprintId]);
    return sprintId;
  }).then((id) => getSprintRow(userId, id));
}

export async function abandonSprint(userId: string, sprintId: string): Promise<RecallSprint> {
  return withTransaction(async (client) => {
    const sprint = await client.query<any>(`SELECT * FROM recall_sprints WHERE id=$1 AND user_id=$2 FOR UPDATE`, [sprintId, userId]);
    if (!sprint.rows[0]) throw notFound("Recall Sprint not found", "SPRINT_NOT_FOUND");
    if (sprint.rows[0].status === "in_progress") {
      await client.query(`UPDATE recall_sprints SET status='abandoned',abandoned_at=now(),updated_at=now() WHERE id=$1`, [sprintId]);
      await client.query(`INSERT INTO learning_events
        (user_id,type,entity_type,entity_id,payload)
        VALUES($1,'SPRINT_ABANDONED','RecallSprint',$2,'{}'::jsonb)`,
        [userId, sprintId]);
    }
    return sprintId;
  }).then((id) => getSprintRow(userId, id));
}

export async function openSprintRepair(userId: string, sprintId: string): Promise<{ sprint: RecallSprint; remediation: Awaited<ReturnType<typeof createGroundedRemediation>> }> {
  await withTransaction(async (client) => {
    const sprintRow = await client.query<any>(`SELECT status FROM recall_sprints WHERE id=$1 AND user_id=$2 FOR UPDATE`, [sprintId,userId]);
    if (!sprintRow.rows[0]) throw notFound("Recall Sprint not found", "SPRINT_NOT_FOUND");
    if (sprintRow.rows[0].status==="abandoned") throw conflict("An abandoned Sprint cannot start repair.","SPRINT_ABANDONED");
  });
  const sprint = await getSprintRow(userId, sprintId);
  if (sprint.repairRemediationId) {
    const { getGroundedRemediation } = await import("../grounding/groundedRemediationService.js");
    return { sprint, remediation: await getGroundedRemediation(userId, sprint.repairRemediationId) };
  }
  if (sprint.items.every((item) => !item.submitted)) throw conflict("Submit at least one Sprint answer before opening repair.", "SPRINT_REPAIR_UNAVAILABLE");

  const ranked = await query<any>(`SELECT si.recall_attempt_id,r.concept_id,kpr.point,kpr.status,kpr.feedback,e.overall_coverage,
      (SELECT count(*)::int
       FROM recall_attempts ra
       JOIN recall_evaluations rae ON rae.recall_attempt_id=ra.id
       JOIN recall_knowledge_point_results rakpr ON rakpr.evaluation_id=rae.id
       WHERE ra.user_id=$2
         AND ra.concept_id=r.concept_id
         AND ra.submitted_at IS NOT NULL
         AND lower(regexp_replace(trim(rakpr.point),'[[:space:]]+',' ','g'))=lower(regexp_replace(trim(kpr.point),'[[:space:]]+',' ','g'))
         AND rakpr.status IN ('partial','missing')) AS misses
    FROM recall_sprint_items si
    JOIN recall_attempts r ON r.id=si.recall_attempt_id AND r.user_id=$2
    JOIN recall_evaluations e ON e.recall_attempt_id=r.id
    JOIN recall_knowledge_point_results kpr ON kpr.evaluation_id=e.id
    WHERE si.sprint_id=$1
      AND kpr.status IN ('partial','missing')
    ORDER BY CASE kpr.status WHEN 'missing' THEN 0 ELSE 1 END,misses DESC,e.overall_coverage ASC,si.position ASC,kpr.point ASC`,
    [sprintId, userId]);
  const target = ranked.rows.find((row) => Boolean(row.point));
  if (!target) throw conflict("No submitted Sprint item identified a repairable knowledge gap.", "SPRINT_NO_REPAIR_GAP");

  const remediation = await createGroundedRemediation(userId, target.recall_attempt_id,{knowledgePoint:target.point});
  if (!remediation) throw conflict("Grounded repair could not be prepared.", "SPRINT_REPAIR_UNAVAILABLE");
  await query(`UPDATE recall_sprints SET repair_remediation_id=$2,updated_at=now() WHERE id=$1 AND user_id=$3`, [sprintId, remediation.id, userId]);
  await query(`INSERT INTO learning_events
    (user_id,type,entity_type,entity_id,payload)
    VALUES($1,'SPRINT_REPAIR_OPENED','RecallSprint',$2,$3)`,
    [userId, sprintId, JSON.stringify({ remediationId: remediation.id, sourceAttemptId: target.recall_attempt_id })]);
  return { sprint: await getSprintRow(userId, sprintId), remediation };
}

export async function startSprintVerification(userId: string, sprintId: string): Promise<{ sprint: RecallSprint; attempt: ReturnType<typeof serializeAttempt>; remediationId: string }> {
  await withTransaction(async (client) => {
    const sprintRow = await client.query<any>(`SELECT status FROM recall_sprints WHERE id=$1 AND user_id=$2 FOR UPDATE`, [sprintId,userId]);
    if (!sprintRow.rows[0]) throw notFound("Recall Sprint not found", "SPRINT_NOT_FOUND");
    if (sprintRow.rows[0].status==="abandoned") throw conflict("An abandoned Sprint cannot start verification.","SPRINT_ABANDONED");
  });
  const sprint = await getSprintRow(userId, sprintId);
  if (!sprint.repairRemediationId) throw conflict("Open the Sprint repair before starting verification.", "SPRINT_VERIFICATION_UNAVAILABLE");
  if (sprint.verificationAttemptId) {
    const attempt = await getAttempt(sprint.verificationAttemptId, userId);
    if (!attempt) throw notFound("Sprint verification attempt not found", "SPRINT_VERIFICATION_NOT_FOUND");
    return { sprint, attempt: serializeAttempt(attempt), remediationId: sprint.repairRemediationId };
  }
  const result = await createVerification(userId, sprint.repairRemediationId);
  await withTransaction(async (client) => {
    await client.query(`UPDATE recall_sprints SET verification_attempt_id=$2,updated_at=now() WHERE id=$1 AND user_id=$3`, [sprintId, result.attempt.id, userId]);
    await client.query(`INSERT INTO learning_events
      (user_id,type,entity_type,entity_id,payload)
      VALUES($1,'SPRINT_VERIFICATION_STARTED','RecallSprint',$2,$3)`,
      [userId, sprintId, JSON.stringify({ attemptId: result.attempt.id })]);
  });
  return { sprint: await getSprintRow(userId, sprintId), attempt: serializeAttempt(result.attempt), remediationId: result.remediationId };
}

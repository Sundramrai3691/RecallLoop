import { query } from "../../db/postgres.js";

function startOfToday(now = new Date()) { const date = new Date(now); date.setHours(0,0,0,0); return date; }
function endOfToday(now = new Date()) { const date = new Date(now); date.setHours(23,59,59,999); return date; }

export async function getDashboard(userId: string) {
  const now = new Date(); const todayStart = startOfToday(now); const todayEnd = endOfToday(now);
  const result=await query<any>(`SELECT
    COALESCE((SELECT json_agg(to_jsonb(due_rows)) FROM (
      SELECT r.id AS "recallId",r.concept_id AS "conceptId",c.name AS "conceptName",r.question,rs.due_at AS "dueAt"
      FROM recall_attempts r JOIN personal_concepts c ON c.id=r.concept_id JOIN review_states rs ON rs.user_id=r.user_id AND rs.concept_id=r.concept_id
      WHERE r.user_id=$1 AND r.submitted_at IS NULL AND rs.due_at <= $2 ORDER BY rs.due_at,r.created_at ASC,r.id ASC
    ) due_rows),'[]'::json) AS today_due,
    COALESCE((SELECT json_agg(to_jsonb(upcoming_rows)) FROM (
      SELECT rs.concept_id AS "conceptId",c.name AS "conceptName",rs.due_at AS "dueAt",rs.interval_days AS "intervalDays"
      FROM review_states rs JOIN personal_concepts c ON c.id=rs.concept_id WHERE rs.user_id=$1 AND rs.due_at > $2 ORDER BY rs.due_at LIMIT 20
    ) upcoming_rows),'[]'::json) AS upcoming,
    COALESCE((SELECT json_agg(to_jsonb(session_rows)) FROM (
      SELECT id,title,status,started_at AS "startedAt",completed_at AS "completedAt" FROM study_sessions WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 8
    ) session_rows),'[]'::json) AS sessions,
    COALESCE((SELECT json_agg(to_jsonb(mastery_rows)) FROM (
      SELECT id,name,mastery,difficulty,study_session_id AS "studySessionId" FROM personal_concepts WHERE user_id=$1 ORDER BY mastery DESC,updated_at DESC LIMIT 40
    ) mastery_rows),'[]'::json) AS mastery,
    (SELECT json_build_object('total',count(*)::int,'submitted',count(*) FILTER (WHERE submitted_at IS NOT NULL)::int) FROM recall_attempts WHERE user_id=$1) AS counts`,[userId,todayEnd]);
  const dashboard=result.rows[0];
  return { generatedAt: now.toISOString(), todayDue: dashboard.today_due, upcoming: dashboard.upcoming, recentlyStudied: dashboard.sessions, masteryByConcept: dashboard.mastery.map((row:any) => ({ ...row, mastery: Number(row.mastery), studySessionId: String(row.studySessionId) })), recallAttemptCount: dashboard.counts.total, submittedRecallCount: dashboard.counts.submitted, pendingRecallCount: dashboard.today_due.length, todayWindow: { start: todayStart, end: todayEnd } };
}

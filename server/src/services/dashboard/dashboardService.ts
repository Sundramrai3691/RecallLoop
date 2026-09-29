import { query } from "../../db/postgres.js";

function startOfToday(now = new Date()) { const date = new Date(now); date.setHours(0,0,0,0); return date; }
function endOfToday(now = new Date()) { const date = new Date(now); date.setHours(23,59,59,999); return date; }

export async function getDashboard(userId: string) {
  const now = new Date(); const todayStart = startOfToday(now); const todayEnd = endOfToday(now);
  const today = await query<any>(`SELECT r.id AS "recallId", r.concept_id AS "conceptId", c.name AS "conceptName", r.question, rs.due_at AS "dueAt" FROM recall_attempts r JOIN personal_concepts c ON c.id=r.concept_id JOIN review_states rs ON rs.user_id=r.user_id AND rs.concept_id=r.concept_id WHERE r.user_id=$1 AND r.submitted_at IS NULL AND rs.due_at <= $2 ORDER BY rs.due_at`, [userId, todayEnd]);
  const upcoming = await query<any>(`SELECT rs.concept_id AS "conceptId", c.name AS "conceptName", rs.due_at AS "dueAt", rs.interval_days AS "intervalDays" FROM review_states rs JOIN personal_concepts c ON c.id=rs.concept_id WHERE rs.user_id=$1 AND rs.due_at > $2 ORDER BY rs.due_at LIMIT 20`, [userId,todayEnd]);
  const sessions = await query<any>(`SELECT id,title,status,started_at AS "startedAt",completed_at AS "completedAt" FROM study_sessions WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 8`, [userId]);
  const mastery = await query<any>(`SELECT id,name,mastery,difficulty,study_session_id AS "studySessionId" FROM personal_concepts WHERE user_id=$1 ORDER BY mastery DESC,updated_at DESC LIMIT 40`, [userId]);
  const counts = await query<any>(`SELECT count(*)::int AS total, count(*) FILTER (WHERE submitted_at IS NOT NULL)::int AS submitted FROM recall_attempts WHERE user_id=$1`, [userId]);
  return { generatedAt: now.toISOString(), todayDue: today.rows, upcoming: upcoming.rows, recentlyStudied: sessions.rows, masteryByConcept: mastery.rows.map((row) => ({ ...row, mastery: Number(row.mastery), studySessionId: String(row.studySessionId) })), recallAttemptCount: counts.rows[0].total, submittedRecallCount: counts.rows[0].submitted, pendingRecallCount: today.rows.length, todayWindow: { start: todayStart, end: todayEnd } };
}

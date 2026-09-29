import { query, withTransaction } from "../db/postgres.js";
import type {
  GoalRecord,
  GoalRepository,
  LearnerSkillRecord,
  LearnerSkillRepository,
  PlanRecord,
  PlanRepository,
  PlanTaskRecord,
  PlanTaskRepository,
  UserRecord,
  UserRepository,
} from "./types.js";

function user(row: any): UserRecord { return { id: row.id, email: row.email, passwordHash: row.password_hash, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at }; }
function goal(row: any): GoalRecord { return { id: row.id, userId: row.user_id, title: row.title, description: row.description, goalType: row.goal_type, targetDate: row.target_date, weeklyTimeBudgetMinutes: row.weekly_time_budget_minutes, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at }; }
function skill(row: any): LearnerSkillRecord { return { id: row.id, userId: row.user_id, goalId: row.goal_id, name: row.name, description: row.description, priority: row.priority, targetMastery: Number(row.target_mastery), currentMastery: Number(row.current_mastery), createdAt: row.created_at, updatedAt: row.updated_at }; }
function plan(row: any): PlanRecord { return { id: row.id, userId: row.user_id, goalId: row.goal_id, startDate: row.start_date, endDate: row.end_date, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at }; }
function task(row: any): PlanTaskRecord { return { id: row.id, userId: row.user_id, planId: row.plan_id, goalId: row.goal_id, skillId: row.skill_id, conceptId: row.concept_id, recallAttemptId: row.recall_attempt_id, taskType: row.task_type, title: row.title, description: row.description, priority: row.priority, estimatedMinutes: row.estimated_minutes, scheduledFor: row.scheduled_for, status: row.status, source: row.source, reason: row.reason, createdAt: row.created_at, updatedAt: row.updated_at }; }

export const userRepository: UserRepository = {
  async findByEmail(email) { const result = await query(`SELECT * FROM app_users WHERE email = $1`, [email]); return result.rows[0] ? user(result.rows[0]) : null; },
  async findById(id) { const result = await query(`SELECT * FROM app_users WHERE id = $1`, [id]); return result.rows[0] ? user(result.rows[0]) : null; },
  async create(input) { const result = await query(`INSERT INTO app_users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *`, [input.email, input.passwordHash, input.name]); return user(result.rows[0]); },
};

export const goalRepository: GoalRepository = {
  async create(userId, input) { const result = await query(`INSERT INTO goals (user_id, title, description, goal_type, target_date, weekly_time_budget_minutes, status) VALUES ($1,$2,$3,$4,$5,$6,'active') RETURNING *`, [userId, input.title, input.description ?? "", input.goalType ?? "learning", input.targetDate ?? null, input.weeklyTimeBudgetMinutes ?? 240]); return goal(result.rows[0]); },
  async list(userId) { const result = await query(`SELECT * FROM goals WHERE user_id = $1 ORDER BY updated_at DESC`, [userId]); return result.rows.map(goal); },
  async findById(id) { const result = await query(`SELECT * FROM goals WHERE id = $1`, [id]); return result.rows[0] ? goal(result.rows[0]) : null; },
  async update(id, userId, input) { const result = await query(`UPDATE goals SET title = COALESCE($3,title), description = COALESCE($4,description), goal_type = COALESCE($5,goal_type), target_date = COALESCE($6,target_date), weekly_time_budget_minutes = COALESCE($7,weekly_time_budget_minutes), status = COALESCE($8,status), updated_at = now() WHERE id = $1 AND user_id = $2 RETURNING *`, [id, userId, input.title ?? null, input.description ?? null, input.goalType ?? null, input.targetDate ?? null, input.weeklyTimeBudgetMinutes ?? null, input.status ?? null]); return result.rows[0] ? goal(result.rows[0]) : null; },
  async delete(id, userId) { const result = await query(`DELETE FROM goals WHERE id = $1 AND user_id = $2`, [id, userId]); return (result.rowCount ?? 0) > 0; },
};

export const learnerSkillRepository: LearnerSkillRepository = {
  async create(userId, goalId, input) { const result = await query(`INSERT INTO learner_skills (user_id, goal_id, name, description, priority, target_mastery, current_mastery) SELECT $1,$2,$3,$4,$5,$6,$7 WHERE EXISTS (SELECT 1 FROM goals WHERE id=$2 AND user_id=$1) RETURNING *`, [userId, goalId, input.name, input.description ?? "", input.priority ?? 50, input.targetMastery ?? 0.8, input.currentMastery ?? 0.3]); return skill(result.rows[0]); },
  async list(userId, goalId) { const result = await query(`SELECT * FROM learner_skills WHERE user_id=$1 AND goal_id=$2 ORDER BY priority DESC, created_at`, [userId, goalId]); return result.rows.map(skill); },
  async findById(id) { const result = await query(`SELECT * FROM learner_skills WHERE id=$1`, [id]); return result.rows[0] ? skill(result.rows[0]) : null; },
  async update(id, userId, input) { const result = await query(`UPDATE learner_skills SET name=COALESCE($3,name), description=COALESCE($4,description), priority=COALESCE($5,priority), target_mastery=COALESCE($6,target_mastery), current_mastery=COALESCE($7,current_mastery), updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING *`, [id,userId,input.name ?? null,input.description ?? null,input.priority ?? null,input.targetMastery ?? null,input.currentMastery ?? null]); return result.rows[0] ? skill(result.rows[0]) : null; },
  async delete(id, userId) { const result = await query(`DELETE FROM learner_skills WHERE id=$1 AND user_id=$2`, [id,userId]); return (result.rowCount ?? 0) > 0; },
};

export const planRepository: PlanRepository = {
  async upsert(userId, goalId, startDate, endDate) { const result = await query(`INSERT INTO plans (user_id,goal_id,start_date,end_date,status) VALUES ($1,$2,$3,$4,'active') ON CONFLICT (user_id,goal_id) DO UPDATE SET start_date=EXCLUDED.start_date,end_date=EXCLUDED.end_date,status='active',updated_at=now() RETURNING *`, [userId,goalId,startDate,endDate]); return plan(result.rows[0]); },
  async findLatest(userId, goalId) { const result = await query(`SELECT * FROM plans WHERE user_id=$1 AND goal_id=$2 ORDER BY created_at DESC LIMIT 1`, [userId,goalId]); return result.rows[0] ? plan(result.rows[0]) : null; },
};

export const planTaskRepository: PlanTaskRepository = {
  async replaceForPlan(userId, planId, tasks) { await withTransaction(async (client) => { await client.query(`DELETE FROM plan_tasks WHERE user_id=$1 AND plan_id=$2`, [userId,planId]); for (const item of tasks) await client.query(`INSERT INTO plan_tasks (user_id,plan_id,goal_id,skill_id,concept_id,recall_attempt_id,task_type,title,description,priority,estimated_minutes,scheduled_for,status,source,reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'planned',$13,$14)`, [userId,planId,item.goalId ?? null,item.skillId ?? null,item.conceptId ?? null,item.recallAttemptId ?? null,item.taskType,item.title,item.description ?? "",item.priority,item.estimatedMinutes,item.scheduledFor,item.source,item.reason ?? ""]); } ); },
  async listForPlan(userId, planId) { const result = await query(`SELECT * FROM plan_tasks WHERE user_id=$1 AND plan_id=$2 ORDER BY priority DESC, scheduled_for`, [userId,planId]); return result.rows.map(task); },
  async listToday(userId,start,end) { const result = await query(`SELECT * FROM plan_tasks WHERE user_id=$1 AND scheduled_for BETWEEN $2 AND $3 ORDER BY priority DESC, scheduled_for`, [userId,start,end]); return result.rows.map(task); },
  async markMissed(userId,before) { await query(`UPDATE plan_tasks SET status='missed',updated_at=now() WHERE user_id=$1 AND status='planned' AND scheduled_for < $2`, [userId,before]); },
  async findById(id) { const result = await query(`SELECT * FROM plan_tasks WHERE id=$1`, [id]); return result.rows[0] ? task(result.rows[0]) : null; },
  async updateStatus(id,userId,status) { const result = await query(`UPDATE plan_tasks SET status=$3,updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING *`, [id,userId,status]); return result.rows[0] ? task(result.rows[0]) : null; },
};

export async function completeStudyWrites(userId: string, sessionId: string, concepts: any[]) {
  return withTransaction(async (client) => {
    const sessionResult = await client.query(`UPDATE study_sessions SET status='completed', completed_at=COALESCE(completed_at,now()), updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING *`, [sessionId,userId]);
    if (!sessionResult.rows[0]) return null;
    const attempts: any[] = [];
    for (const concept of concepts) {
      const existing = await client.query(`SELECT id FROM recall_attempts WHERE user_id=$1 AND concept_id=$2 AND submitted_at IS NULL ORDER BY created_at LIMIT 1`, [userId,concept.id]);
      let attemptId = existing.rows[0]?.id;
      if (!attemptId) { const created = await client.query(`INSERT INTO recall_attempts (user_id,concept_id,study_session_id,question_type,question) VALUES ($1,$2,$3,'explain',$4) RETURNING id`, [userId,concept.id,sessionId,`Without looking at your notes, explain how ${concept.name} works from start to finish.`]); attemptId = created.rows[0].id; }
      attempts.push(attemptId);
      await client.query(`INSERT INTO review_states (user_id,concept_id,state,due_at,difficulty) VALUES ($1,$2,'new',now(),$3) ON CONFLICT (user_id,concept_id) DO UPDATE SET due_at=LEAST(review_states.due_at,EXCLUDED.due_at),updated_at=now()`, [userId,concept.id,Number(concept.difficulty)/5]);
    }
    await client.query(`INSERT INTO learning_events (user_id,type,entity_type,entity_id,payload) VALUES ($1,'STUDY_COMPLETED','StudySession',$2,$3)`, [userId,sessionId,JSON.stringify({ conceptCount: concepts.length })]);
    const row = sessionResult.rows[0];
    return { session: { id: row.id, userId: row.user_id, title: row.title, rawMaterial: row.raw_material, sourceType: row.source_type, startedAt: row.started_at, completedAt: row.completed_at, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at }, attempts };
  });
}

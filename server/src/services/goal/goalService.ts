import { query } from "../../db/postgres.js";
import { AppError, notFound } from "../../utils/errors.js";
import { goalRepository, learnerSkillRepository, planRepository, planTaskRepository } from "../../repositories/postgresRepositories.js";
import type { GoalRecord, LearnerSkillRecord, PlanTaskRecord } from "../../repositories/types.js";

function serializeGoal(goal: GoalRecord) {
  return { id: goal.id, userId: goal.userId, title: goal.title, description: goal.description, goalType: goal.goalType, targetDate: goal.targetDate, weeklyTimeBudgetMinutes: goal.weeklyTimeBudgetMinutes, status: goal.status, createdAt: goal.createdAt, updatedAt: goal.updatedAt };
}
function serializeSkill(skill: LearnerSkillRecord) {
  return { id: skill.id, goalId: skill.goalId, userId: skill.userId, name: skill.name, description: skill.description, priority: skill.priority, targetMastery: skill.targetMastery, currentMastery: skill.currentMastery, createdAt: skill.createdAt, updatedAt: skill.updatedAt };
}
function serializeTask(task: PlanTaskRecord) {
  return { id: task.id, taskType: task.taskType, title: task.title, description: task.description, priority: task.priority, estimatedMinutes: task.estimatedMinutes, scheduledFor: task.scheduledFor, status: task.status, source: task.source, reason: task.reason, conceptId: task.conceptId, recallAttemptId: task.recallAttemptId };
}

async function ownedGoal(userId: string, goalId: string) {
  const goal = await goalRepository.findById(goalId);
  if (!goal) throw notFound("Goal not found", "GOAL_NOT_FOUND");
  if (goal.userId !== userId) throw new AppError("You do not have access to this resource", 403, "FORBIDDEN");
  return goal;
}

export async function createGoal(userId: string, input: Record<string, any>) {
  const title = input.title?.trim();
  if (!title) throw new AppError("Goal title is required", 400, "VALIDATION_ERROR");
  return serializeGoal(await goalRepository.create(userId, { ...input, title }));
}
export async function listGoals(userId: string) { return (await goalRepository.list(userId)).map(serializeGoal); }
export async function getGoal(userId: string, goalId: string) { return serializeGoal(await ownedGoal(userId, goalId)); }
export async function updateGoal(userId: string, goalId: string, input: Record<string, any>) {
  await ownedGoal(userId, goalId);
  const updated = await goalRepository.update(goalId, userId, input);
  if (!updated) throw notFound("Goal not found", "GOAL_NOT_FOUND");
  return serializeGoal(updated);
}
export async function deleteGoal(userId: string, goalId: string) {
  await ownedGoal(userId, goalId);
  if (!(await goalRepository.delete(goalId, userId))) throw notFound("Goal not found", "GOAL_NOT_FOUND");
  return { deleted: true };
}

export async function createSkill(userId: string, goalId: string, input: Record<string, any>) {
  await ownedGoal(userId, goalId);
  const name = input.name?.trim();
  if (!name) throw new AppError("Skill name is required", 400, "VALIDATION_ERROR");
  const skill = await learnerSkillRepository.create(userId, goalId, { ...input, name });
  if (!skill) throw notFound("Goal not found", "GOAL_NOT_FOUND");
  return { skill: serializeSkill(skill) };
}
export async function listSkills(userId: string, goalId: string) { await ownedGoal(userId, goalId); return (await learnerSkillRepository.list(userId, goalId)).map(serializeSkill); }
export async function updateSkill(userId: string, skillId: string, input: Record<string, any>) {
  const existing = await learnerSkillRepository.findById(skillId);
  if (!existing) throw notFound("Skill not found", "SKILL_NOT_FOUND");
  if (existing.userId !== userId) throw new AppError("You do not have access to this resource", 403, "FORBIDDEN");
  const skill = await learnerSkillRepository.update(skillId, userId, input);
  if (!skill) throw notFound("Skill not found", "SKILL_NOT_FOUND");
  return serializeSkill(skill);
}
export async function deleteSkill(userId: string, skillId: string) {
  const existing = await learnerSkillRepository.findById(skillId);
  if (!existing) throw notFound("Skill not found", "SKILL_NOT_FOUND");
  if (existing.userId !== userId) throw new AppError("You do not have access to this resource", 403, "FORBIDDEN");
  await learnerSkillRepository.delete(skillId, userId);
  return { deleted: true };
}

async function dueRecallTasks(userId: string) {
  const result = await query<any>(`SELECT r.concept_id AS "conceptId", r.id AS "recallAttemptId", c.name, rs.due_at AS "scheduledFor" FROM review_states rs JOIN personal_concepts c ON c.id=rs.concept_id AND c.user_id=rs.user_id JOIN recall_attempts r ON r.concept_id=c.id AND r.user_id=c.user_id AND r.submitted_at IS NULL WHERE rs.user_id=$1 AND rs.due_at <= now() ORDER BY rs.due_at`, [userId]);
  return result.rows.map((row) => ({ title: `Review ${row.name}`, description: "Due for spaced review.", taskType: "recall", priority: 100, estimatedMinutes: 20, scheduledFor: row.scheduledFor, source: "scheduler", conceptId: row.conceptId, recallAttemptId: row.recallAttemptId, reason: "Due for spaced review." }));
}
async function weakConceptTasks(userId: string) {
  const result = await query<any>(`SELECT id AS "conceptId", name, mastery FROM personal_concepts WHERE user_id=$1 AND mastery < 0.7 ORDER BY mastery, updated_at DESC LIMIT 5`, [userId]);
  return result.rows.map((row) => ({ title: `Strengthen ${row.name}`, description: "Review a weak concept and rebuild missing knowledge points.", taskType: "practice", priority: 78, estimatedMinutes: 25, scheduledFor: new Date(), source: "learner_model", conceptId: row.conceptId, reason: `Previous observed mastery was ${Math.round(Number(row.mastery) * 100)}%.` }));
}
async function learningTasks(userId: string, goalId: string) {
  return (await learnerSkillRepository.list(userId, goalId)).slice(0, 4).map((skill) => ({ title: `Learn ${skill.name}`, description: skill.description || `Required for this goal: ${skill.name}.`, taskType: "learn", priority: skill.priority, estimatedMinutes: 30, scheduledFor: new Date(), source: "planner", skillId: skill.id, reason: `Required for goal; priority ${skill.priority}.` }));
}

export async function generateGoalPlan(userId: string, goalId: string) {
  const goal = await ownedGoal(userId, goalId);
  const due = await dueRecallTasks(userId);
  const weak = await weakConceptTasks(userId);
  const learn = await learningTasks(userId, goalId);
  const fallback = due.length ? [] : [{ title: "Review your active goal", description: "Keep retrieval practice active while the goal curriculum is starting.", taskType: "recall", priority: 95, estimatedMinutes: 20, scheduledFor: new Date(), source: "planner", reason: "The plan requires a recall task alongside learning work." }];
  const candidates: any[] = [...due, ...fallback, ...weak, ...learn].sort((a, b) => b.priority - a.priority);
  const budget = Math.max(60, Math.ceil(goal.weeklyTimeBudgetMinutes / 7));
  const selected: any[] = [];
  let minutes = 0;
  const seen = new Set<string>();
  for (const item of candidates) {
    const key = item.taskType === "recall" ? String(item.recallAttemptId ?? item.conceptId ?? item.title) : "";
    if (key && seen.has(key)) continue;
    if (selected.length && minutes + item.estimatedMinutes > budget) continue;
    selected.push({ ...item, goalId }); minutes += item.estimatedMinutes; if (key) seen.add(key);
  }
  const start = new Date(); const end = new Date(start); end.setDate(end.getDate() + 7);
  const plan = await planRepository.upsert(userId, goalId, start, end);
  await planTaskRepository.replaceForPlan(userId, plan.id, selected);
  return { plan: { id: plan.id, goalId: plan.goalId, userId: plan.userId, startDate: plan.startDate, endDate: plan.endDate, status: plan.status }, tasks: (await planTaskRepository.listForPlan(userId, plan.id)).map(serializeTask) };
}

export async function getGoalPlan(userId: string, goalId: string) {
  await ownedGoal(userId, goalId);
  const plan = await planRepository.findLatest(userId, goalId);
  if (!plan) return { plan: null, tasks: [] };
  return { plan: { id: plan.id, goalId: plan.goalId, userId: plan.userId, startDate: plan.startDate, endDate: plan.endDate, status: plan.status }, tasks: (await planTaskRepository.listForPlan(userId, plan.id)).map(serializeTask) };
}
export async function getTodayPlan(userId: string) {
  const start = new Date(); start.setHours(0, 0, 0, 0); const end = new Date(); end.setHours(23, 59, 59, 999);
  await planTaskRepository.markMissed(userId, start);
  let tasks = await planTaskRepository.listToday(userId, start, end);
  if (!tasks.length) { const active = (await goalRepository.list(userId)).find((goal) => goal.status === "active"); if (active) return generateGoalPlan(userId, active.id); }
  return { plan: { generatedAt: new Date().toISOString() }, tasks: tasks.map(serializeTask) };
}
export async function updatePlanTask(userId: string, taskId: string, status: "planned" | "in_progress" | "completed" | "missed") {
  const existing = await planTaskRepository.findById(taskId);
  if (!existing) throw notFound("Plan task not found", "PLAN_TASK_NOT_FOUND");
  if (existing.userId !== userId) throw new AppError("You do not have access to this resource", 403, "FORBIDDEN");
  const task = await planTaskRepository.updateStatus(taskId, userId, status);
  return { id: task!.id, status: task!.status };
}

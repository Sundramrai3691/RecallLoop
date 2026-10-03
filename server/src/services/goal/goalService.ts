import { query } from "../../db/postgres.js";
import { AppError, notFound } from "../../utils/errors.js";
import { goalRepository, learnerSkillRepository, planRepository, planTaskRepository } from "../../repositories/postgresRepositories.js";
import type { GoalRecord, LearnerSkillRecord, PlanTaskRecord } from "../../repositories/types.js";
import { fitTasksToBudget } from "./planSelection.js";
import { buildLearningPack } from "../resources/learningPackService.js";

function serializeGoal(goal: GoalRecord) {
  return { id: goal.id, userId: goal.userId, title: goal.title, description: goal.description, goalType: goal.goalType, targetDate: goal.targetDate, weeklyTimeBudgetMinutes: goal.weeklyTimeBudgetMinutes, status: goal.status, createdAt: goal.createdAt, updatedAt: goal.updatedAt };
}
function serializeSkill(skill: LearnerSkillRecord) {
  return { id: skill.id, goalId: skill.goalId, userId: skill.userId, name: skill.name, description: skill.description, priority: skill.priority, targetMastery: skill.targetMastery, currentMastery: skill.currentMastery, createdAt: skill.createdAt, updatedAt: skill.updatedAt };
}
function serializeTask(task: PlanTaskRecord) {
  return { id: task.id, taskType: task.taskType, title: task.title, description: task.description, priority: task.priority, estimatedMinutes: task.estimatedMinutes, scheduledFor: task.scheduledFor, status: task.status, source: task.source, reason: task.reason, conceptId: task.conceptId, recallAttemptId: task.recallAttemptId, category: task.category, requiredness: task.requiredness, sequenceOrder: task.sequenceOrder, resourceUrl: task.resourceUrl };
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
  const result = await query<any>(`SELECT r.concept_id AS "conceptId", r.id AS "recallAttemptId", c.name, rs.due_at AS "scheduledFor",rs.due_at::date < CURRENT_DATE AS overdue FROM review_states rs JOIN personal_concepts c ON c.id=rs.concept_id AND c.user_id=rs.user_id JOIN recall_attempts r ON r.concept_id=c.id AND r.user_id=c.user_id AND r.submitted_at IS NULL WHERE rs.user_id=$1 AND rs.due_at <= now() ORDER BY rs.due_at`, [userId]);
  return result.rows.map((row) => ({ title: `Recall · ${row.name}`, description: "Retrieve this concept from memory, then check what needs work.", taskType: "recall", category: "must_do", requiredness: "must", sequenceOrder: row.overdue ? 10 : 20, priority: row.overdue ? 100 : 95, estimatedMinutes: 10, scheduledFor: row.scheduledFor, source: "scheduler", conceptId: row.conceptId, recallAttemptId: row.recallAttemptId, reason: row.overdue ? "Overdue recall." : "Due for review today." }));
}
async function weakConceptTasks(userId: string) {
  const result = await query<any>(`SELECT c.id AS "conceptId",c.name,c.mastery,
    (SELECT count(*)::int FROM (SELECT e.overall_coverage FROM recall_attempts r JOIN recall_evaluations e ON e.recall_attempt_id=r.id WHERE r.concept_id=c.id AND r.user_id=c.user_id ORDER BY r.submitted_at DESC LIMIT 3) recent WHERE overall_coverage < .55) AS failures,
    (SELECT d.score::float FROM recall_dimension_results d JOIN recall_attempts r ON r.id=d.recall_attempt_id WHERE r.concept_id=c.id AND r.user_id=c.user_id AND d.dimension='recall' ORDER BY r.submitted_at DESC LIMIT 1) AS "recallScore",
    (SELECT d.score::float FROM recall_dimension_results d JOIN recall_attempts r ON r.id=d.recall_attempt_id WHERE r.concept_id=c.id AND r.user_id=c.user_id AND d.dimension='application' ORDER BY r.submitted_at DESC LIMIT 1) AS "applicationScore"
    FROM personal_concepts c WHERE c.user_id=$1 AND c.mastery < .7 AND EXISTS(SELECT 1 FROM recall_attempts assessed WHERE assessed.user_id=c.user_id AND assessed.concept_id=c.id AND assessed.submitted_at IS NOT NULL) ORDER BY c.mastery,c.updated_at DESC LIMIT 5`, [userId]);
  return result.rows.map((row) => {
    const critical = Number(row.failures) >= 2;
    const recall = row.recallScore == null ? null : Number(row.recallScore);
    const application = row.applicationScore == null ? null : Number(row.applicationScore);
    const appGap = recall !== null && (application === null || recall-application >= .2);
    return { title: `${critical ? "Remediate" : appGap ? "Practice" : "Review"} · ${row.name}`, description: critical ? "Rebuild the concept after repeated low-coverage attempts." : "Strengthen the weakest evidence dimension.", taskType: critical ? "remediation" : "practice", category: critical ? "must_do" : "recommended", requiredness: critical ? "must" : "recommended", sequenceOrder: critical ? 30 : 50, priority: critical ? 92 : 78, estimatedMinutes: critical ? 15 : 20, scheduledFor: new Date(), source: "learner_model", conceptId: row.conceptId, reason: critical ? `Recall coverage was below 55% on ${row.failures} of the last three attempts.` : appGap ? application === null ? `Application evidence is not recorded; recall evidence is ${Math.round(recall!*100)}%.` : `Application performance (${Math.round(application*100)}%) is weaker than recall (${Math.round(recall!*100)}%).` : `Observed mastery is ${Math.round(Number(row.mastery)*100)}%.` };
  });
}
async function learningTasks(userId: string, goalId: string) {
  return (await learnerSkillRepository.list(userId, goalId)).slice(0, 4).map((skill) => ({ title: `Learn · ${skill.name}`, description: skill.description || `Required for this goal: ${skill.name}.`, taskType: "learn", category: "recommended", requiredness: "recommended", sequenceOrder: 40, priority: skill.priority, estimatedMinutes: 20, scheduledFor: new Date(), source: "planner", skillId: skill.id, reason: `Required for active goal; priority ${skill.priority}.` }));
}
async function optionalTasks(userId:string){const result=await query<any>(`SELECT c.id AS "conceptId",c.name,c.mastery FROM personal_concepts c WHERE c.user_id=$1 AND c.mastery>=.8 AND (SELECT count(*) FROM (SELECT dimension,AVG(score) score FROM recall_dimension_results d JOIN recall_attempts r ON r.id=d.recall_attempt_id WHERE r.concept_id=c.id GROUP BY dimension) dimensions WHERE score>=.7)>=3 ORDER BY c.mastery DESC LIMIT 2`,[userId]);return result.rows.map((row)=>({title:`Stretch · ${row.name}`,description:"Sample a broader set of evidence for a well-supported concept.",taskType:"assessment",category:"optional",requiredness:"optional",sequenceOrder:70,priority:40,estimatedMinutes:10,scheduledFor:new Date(),source:"learner_model",conceptId:row.conceptId,reason:`Observed mastery is ${Math.round(Number(row.mastery)*100)}% with at least three dimensions at or above 70%.`}));}

export async function generateGoalPlan(userId: string, goalId: string, requestedMinutes?: number) {
  const goal = await ownedGoal(userId, goalId);
  const due = await dueRecallTasks(userId);
  const weak = await weakConceptTasks(userId);
  const learn = await learningTasks(userId, goalId);
  const optional=await optionalTasks(userId);
  const dailyAverage = Math.ceil(goal.weeklyTimeBudgetMinutes / 7);
  const budget = Math.max(0, Math.min(240, Number.isFinite(requestedMinutes) ? Math.floor(requestedMinutes!) : dailyAverage));
  const missed = await query<any>(`SELECT task_type AS "taskType",concept_id AS "conceptId",skill_id AS "skillId",title FROM plan_tasks WHERE user_id=$1 AND status='missed' AND scheduled_for::date=CURRENT_DATE-1 ORDER BY priority DESC`,[userId]);
  const goalConcept = weak[0] ? await query<any>(`SELECT c.id AS "conceptId" FROM personal_concepts c JOIN learner_skills s ON s.user_id=c.user_id AND lower(s.name)=lower(c.name) WHERE c.id=$1 AND c.user_id=$2 AND s.goal_id=$3 LIMIT 1`,[weak[0].conceptId,userId,goalId]) : {rows:[]};
  const packConcept = goalConcept.rows[0] ?? null;
  const pack=packConcept?await buildLearningPack({userId,conceptId:packConcept.conceptId,goalId,availableMinutes:budget}):null;
  const packTasks:any[]=(pack?.items??[]).map((item,index)=>({title:item.title,description:item.url?`${item.reason}`:item.reason,taskType:item.kind==="resource"?"learn":item.kind==="recall"?"recall":"practice",category:"recommended",requiredness:"recommended",sequenceOrder:item.kind==="resource"?45:item.kind==="explanation"?46:item.kind==="application"?50:60,priority:item.kind==="resource"?74:item.kind==="application"?70:65,estimatedMinutes:item.minutes,scheduledFor:new Date(),source:"planner",conceptId:packConcept.conceptId,resourceUrl:item.url??null,reason:item.reason,packOrder:index+1}));
  const packConceptId=pack?packConcept.conceptId:null;
  const candidates: any[] = [...due,...weak.filter((item:any)=>item.requiredness==="must"||item.conceptId!==packConceptId),...learn,...packTasks,...optional].sort((a, b) => a.sequenceOrder - b.sequenceOrder || b.priority - a.priority);
  const fit = fitTasksToBudget(candidates,budget,goalId);
  const selected = fit.tasks;
  const start = new Date(); const end = new Date(start); end.setDate(end.getDate() + 7);
  const plan = await planRepository.upsert(userId, goalId, start, end, budget, fit.plannedMinutes);
  await planTaskRepository.replaceForPlan(userId, plan.id, selected);
  const carriedForwardCount=missed.rows.filter((old:any)=>selected.some((task:any)=>old.conceptId&&old.conceptId===task.conceptId||old.skillId&&old.skillId===task.skillId)).length;
  return { plan: { id: plan.id, goalId: plan.goalId, userId: plan.userId, startDate: plan.startDate, endDate: plan.endDate, status: plan.status }, timeBudget: { availableMinutes: budget, plannedMinutes: fit.plannedMinutes, remainingMinutes: fit.remainingMinutes }, backlog: { carriedForwardCount, deferredCount: Math.max(0,missed.rows.length-carriedForwardCount) }, tasks: (await planTaskRepository.listForPlan(userId, plan.id)).map(serializeTask) };
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
  const plannedMinutes = tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0);
  const budgetResult = tasks[0] ? await query<any>(`SELECT available_minutes AS "availableMinutes", planned_minutes AS "plannedMinutes" FROM plans WHERE id=$1`,[tasks[0].planId]) : { rows: [] };
  const budgetRow = budgetResult.rows[0];
  const timeBudget = budgetRow?.availableMinutes != null ? { availableMinutes: budgetRow.availableMinutes, plannedMinutes: budgetRow.plannedMinutes, remainingMinutes: budgetRow.availableMinutes-budgetRow.plannedMinutes } : null;
  const missed=await query<any>(`SELECT task_type AS "taskType",concept_id AS "conceptId",skill_id AS "skillId" FROM plan_tasks WHERE user_id=$1 AND status='missed' AND scheduled_for::date=CURRENT_DATE-1`,[userId]);
  const carriedForwardCount=missed.rows.filter((old:any)=>tasks.some((task:any)=>old.conceptId&&old.conceptId===task.conceptId||old.skillId&&old.skillId===task.skillId)).length;
  return { plan: { generatedAt: new Date().toISOString() }, timeBudget, backlog:{carriedForwardCount,deferredCount:Math.max(0,missed.rows.length-carriedForwardCount)}, tasks: tasks.map(serializeTask) };
}
export async function updatePlanTask(userId: string, taskId: string, status: "planned" | "in_progress" | "completed" | "missed") {
  const existing = await planTaskRepository.findById(taskId);
  if (!existing) throw notFound("Plan task not found", "PLAN_TASK_NOT_FOUND");
  if (existing.userId !== userId) throw new AppError("You do not have access to this resource", 403, "FORBIDDEN");
  const task = await planTaskRepository.updateStatus(taskId, userId, status);
  return { id: task!.id, status: task!.status };
}

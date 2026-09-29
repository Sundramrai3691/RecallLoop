import { Goal, type GoalDoc } from "../../models/Goal.js";
import { Plan } from "../../models/Plan.js";
import { PlanTask } from "../../models/PlanTask.js";
import { Skill, type SkillDoc } from "../../models/Skill.js";
import { RecallAttempt } from "../../models/RecallAttempt.js";
import { ReviewState } from "../../models/ReviewState.js";
import { Concept } from "../../models/Concept.js";
import { AppError, notFound } from "../../utils/errors.js";
import { getWeakConcepts } from "../learner/learnerModelService.js";

export function serializeGoal(goal: InstanceType<typeof Goal>) {
  return {
    id: String(goal._id),
    userId: goal.userId,
    title: goal.title,
    description: goal.description,
    goalType: goal.goalType,
    targetDate: goal.targetDate ?? null,
    weeklyTimeBudgetMinutes: goal.weeklyTimeBudgetMinutes,
    status: goal.status,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
}

export async function createGoal(userId: string, input: Partial<GoalDoc> & { title?: string }) {
  const title = input.title?.trim();
  if (!title) {
    throw new AppError("Goal title is required", 400, "VALIDATION_ERROR");
  }

  const goal = await Goal.create({
    userId,
    title,
    description: input.description ?? "",
    goalType: input.goalType ?? "learning",
    targetDate: input.targetDate,
    weeklyTimeBudgetMinutes: input.weeklyTimeBudgetMinutes ?? 240,
    status: "active",
  });

  return serializeGoal(goal);
}

export async function listGoals(userId: string) {
  const goals = await Goal.find({ userId }).sort({ updatedAt: -1 });
  return goals.map((goal) => serializeGoal(goal));
}

export async function getGoal(userId: string, goalId: string) {
  const goal = await Goal.findById(goalId);
  if (!goal) throw notFound("Goal not found", "GOAL_NOT_FOUND");
  if (goal.userId !== userId) throw new AppError("You do not have access to this resource", 403, "FORBIDDEN");
  return serializeGoal(goal);
}

export async function updateGoal(userId: string, goalId: string, input: Partial<GoalDoc>) {
  const goal = await Goal.findById(goalId);
  if (!goal) throw notFound("Goal not found", "GOAL_NOT_FOUND");
  if (goal.userId !== userId) throw new AppError("You do not have access to this resource", 403, "FORBIDDEN");

  if (typeof input.title === "string") goal.title = input.title.trim();
  if (typeof input.description === "string") goal.description = input.description;
  if (input.goalType) goal.goalType = input.goalType;
  if (input.targetDate) goal.targetDate = input.targetDate;
  if (typeof input.weeklyTimeBudgetMinutes === "number") goal.weeklyTimeBudgetMinutes = input.weeklyTimeBudgetMinutes;
  if (input.status) goal.status = input.status;

  await goal.save();
  return serializeGoal(goal);
}

export async function deleteGoal(userId: string, goalId: string) {
  const goal = await Goal.findById(goalId);
  if (!goal) throw notFound("Goal not found", "GOAL_NOT_FOUND");
  if (goal.userId !== userId) throw new AppError("You do not have access to this resource", 403, "FORBIDDEN");

  await Skill.deleteMany({ userId, goalId: goal._id });
  await Plan.deleteMany({ userId, goalId: goal._id });
  await PlanTask.deleteMany({ userId, goalId: goal._id });
  await goal.deleteOne();
  return { deleted: true };
}

export async function createSkill(userId: string, goalId: string, input: Partial<SkillDoc>) {
  const goal = await Goal.findById(goalId);
  if (!goal) throw notFound("Goal not found", "GOAL_NOT_FOUND");
  if (goal.userId !== userId) throw new AppError("You do not have access to this resource", 403, "FORBIDDEN");

  const name = input.name?.trim();
  if (!name) throw new AppError("Skill name is required", 400, "VALIDATION_ERROR");

  const skill = await Skill.create({
    userId,
    goalId: goal._id,
    name,
    description: input.description ?? "",
    priority: input.priority ?? 50,
    targetMastery: input.targetMastery ?? 0.8,
    currentMastery: input.currentMastery ?? 0.4,
  });

  return {
    skill: {
      id: String(skill._id),
      goalId: String(skill.goalId),
      userId: skill.userId,
      name: skill.name,
      description: skill.description,
      priority: skill.priority,
      targetMastery: skill.targetMastery,
      currentMastery: skill.currentMastery,
      createdAt: skill.createdAt,
      updatedAt: skill.updatedAt,
    },
  };
}

export async function listSkills(userId: string, goalId: string) {
  const goal = await Goal.findById(goalId);
  if (!goal) throw notFound("Goal not found", "GOAL_NOT_FOUND");
  if (goal.userId !== userId) throw new AppError("You do not have access to this resource", 403, "FORBIDDEN");

  const skills = await Skill.find({ userId, goalId: goal._id }).sort({ priority: -1, createdAt: 1 });
  return skills.map((skill) => ({
    id: String(skill._id),
    goalId: String(skill.goalId),
    userId: skill.userId,
    name: skill.name,
    description: skill.description,
    priority: skill.priority,
    targetMastery: skill.targetMastery,
    currentMastery: skill.currentMastery,
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
  }));
}

export async function updateSkill(userId: string, skillId: string, input: Partial<any>) {
  const skill = await Skill.findById(skillId);
  if (!skill) throw notFound("Skill not found", "SKILL_NOT_FOUND");
  if (skill.userId !== userId) throw new AppError("You do not have access to this resource", 403, "FORBIDDEN");

  if (typeof input.name === "string") skill.name = input.name.trim();
  if (typeof input.description === "string") skill.description = input.description;
  if (typeof input.priority === "number") skill.priority = input.priority;
  if (typeof input.targetMastery === "number") skill.targetMastery = input.targetMastery;
  if (typeof input.currentMastery === "number") skill.currentMastery = input.currentMastery;

  await skill.save();
  return {
    id: String(skill._id),
    goalId: String(skill.goalId),
    userId: skill.userId,
    name: skill.name,
    description: skill.description,
    priority: skill.priority,
    targetMastery: skill.targetMastery,
    currentMastery: skill.currentMastery,
  };
}

export async function deleteSkill(userId: string, skillId: string) {
  const skill = await Skill.findById(skillId);
  if (!skill) throw notFound("Skill not found", "SKILL_NOT_FOUND");
  if (skill.userId !== userId) throw new AppError("You do not have access to this resource", 403, "FORBIDDEN");
  await skill.deleteOne();
  return { deleted: true };
}

async function getDueRecallTasksForGoal(userId: string, goalId: string) {
  const dueReviews = await ReviewState.find({ dueAt: { $lte: new Date() } }).sort({ dueAt: 1 });
  const recallIds = dueReviews.map((review) => review.conceptId);
  const concepts = await Concept.find({ _id: { $in: recallIds }, userId });
  const conceptMap = new Map(concepts.map((concept) => [String(concept._id), concept]));

  const tasks: Array<{
    title: string;
    description: string;
    taskType: "recall";
    priority: number;
    estimatedMinutes: number;
    scheduledFor: Date;
    source: "scheduler";
    conceptId?: any;
    recallAttemptId?: any;
    reason: string;
  }> = [];

  for (const review of dueReviews) {
    const concept = conceptMap.get(String(review.conceptId));
    if (!concept) continue;
    const attempt = await RecallAttempt.findOne({ conceptId: concept._id, userId, submittedAt: { $exists: false } }).sort({ createdAt: 1 });
    if (!attempt) continue;

    tasks.push({
      title: `Review ${concept.name}`,
      description: `Recall and check the concept again because it is due for review.`,
      taskType: "recall",
      priority: 100,
      estimatedMinutes: 20,
      scheduledFor: new Date(review.dueAt),
      source: "scheduler",
      conceptId: concept._id,
      recallAttemptId: attempt._id,
      reason: `due for review; review state dueAt ${review.dueAt.toISOString()}`,
    });
  }

  return tasks;
}

async function getWeakConceptTasksForGoal(userId: string, goalId: string) {
  const weakConcepts = await getWeakConcepts(userId, 5);
  return weakConcepts.map((concept) => ({
    title: `Strengthen ${concept.conceptName}`,
    description: `Review weak concept and rebuild the missing knowledge points.`,
    taskType: "practice",
    priority: 78,
    estimatedMinutes: 25,
    scheduledFor: new Date(),
    source: "learner_model" as const,
    conceptId: concept.conceptId,
    reason: `mastery ${concept.mastery.toFixed(2)} and status ${concept.status}`,
  }));
}

async function getSkillLearningTasksForGoal(userId: string, goalId: string) {
  const skills = await Skill.find({ userId, goalId }).sort({ priority: -1 }).limit(4);
  return skills.map((skill) => ({
    title: `Learn ${skill.name}`,
    description: skill.description || `Focus on ${skill.name} to move toward your goal target.`,
    taskType: "learn",
    priority: skill.priority,
    estimatedMinutes: 30,
    scheduledFor: new Date(),
    source: "planner" as const,
    skillId: skill._id,
    reason: `skill priority ${skill.priority}, current mastery ${skill.currentMastery}`,
  }));
}

export async function generateGoalPlan(userId: string, goalId: string) {
  const goal = await Goal.findById(goalId);
  if (!goal) throw notFound("Goal not found", "GOAL_NOT_FOUND");
  if (goal.userId !== userId) throw new AppError("You do not have access to this resource", 403, "FORBIDDEN");

  const dueRecallTasks = await getDueRecallTasksForGoal(userId, goalId);
  const weakConceptTasks = await getWeakConceptTasksForGoal(userId, goalId);
  const learningTasks = await getSkillLearningTasksForGoal(userId, goalId);
  const fallbackRecall = dueRecallTasks.length > 0
    ? []
    : learningTasks.length > 0
    ? [{
        title: `Recall ${learningTasks[0].title.replace(/^Learn\s+/, "")}`,
        description: "Review the relevant skill and check your recall before advancing.",
        taskType: "recall",
        priority: 95,
        estimatedMinutes: 20,
        scheduledFor: new Date(),
        source: "planner",
        reason: "Plan requires a recall task alongside learning work for the current goal.",
      }]
    : [{
        title: "Review your active goal",
        description: "Recall the key ideas behind your goal before moving to new learning tasks.",
        taskType: "recall",
        priority: 95,
        estimatedMinutes: 20,
        scheduledFor: new Date(),
        source: "planner",
        reason: "Deterministic planner needs at least one recall task to keep retrieval practice active.",
      }];

  const tasks: any[] = [
    ...dueRecallTasks,
    ...fallbackRecall,
    ...weakConceptTasks,
    ...learningTasks,
  ];

  const dailyBudget = Math.max(60, Math.ceil(goal.weeklyTimeBudgetMinutes / 7));
  const seenRecallKeys = new Set<string>();
  const limited: any[] = [];
  let plannedMinutes = 0;
  for (const task of tasks.sort((a, b) => b.priority - a.priority)) {
    const recallKey = task.taskType === "recall"
      ? String(task.recallAttemptId ?? task.conceptId ?? task.title)
      : null;
    if (recallKey && seenRecallKeys.has(recallKey)) continue;
    if (limited.length > 0 && plannedMinutes + task.estimatedMinutes > dailyBudget) continue;
    limited.push(task);
    plannedMinutes += task.estimatedMinutes;
    if (recallKey) seenRecallKeys.add(recallKey);
  }

  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7);

  const draftPlan = await Plan.findOneAndUpdate(
    { userId, goalId: goal._id },
    {
      userId,
      goalId: goal._id,
      startDate,
      endDate,
      status: "active",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await PlanTask.deleteMany({ userId, planId: draftPlan._id });
  for (const task of limited) {
    await PlanTask.create({
      userId,
      planId: draftPlan._id,
      goalId: goal._id,
      skillId: task.skillId,
      conceptId: task.conceptId,
      recallAttemptId: task.recallAttemptId,
      taskType: task.taskType,
      title: task.title,
      description: task.description,
      priority: task.priority,
      estimatedMinutes: task.estimatedMinutes,
      scheduledFor: task.scheduledFor,
      status: "planned",
      source: task.source,
      reason: task.reason,
    });
  }

  const planTasks = await PlanTask.find({ userId, planId: draftPlan._id }).sort({ priority: -1, scheduledFor: 1});

  return {
    plan: {
      id: String(draftPlan._id),
      goalId: String(draftPlan.goalId),
      userId: draftPlan.userId,
      startDate: draftPlan.startDate,
      endDate: draftPlan.endDate,
      status: draftPlan.status,
    },
    tasks: planTasks.map((task) => ({
      id: String(task._id),
      taskType: task.taskType,
      title: task.title,
      description: task.description,
      priority: task.priority,
      estimatedMinutes: task.estimatedMinutes,
      scheduledFor: task.scheduledFor,
      status: task.status,
      source: task.source,
      reason: task.reason,
      conceptId: task.conceptId ? String(task.conceptId) : null,
      recallAttemptId: task.recallAttemptId ? String(task.recallAttemptId) : null,
    })),
  };
}

export async function getGoalPlan(userId: string, goalId: string) {
  const goal = await Goal.findById(goalId);
  if (!goal) throw notFound("Goal not found", "GOAL_NOT_FOUND");
  if (goal.userId !== userId) throw new AppError("You do not have access to this resource", 403, "FORBIDDEN");

  const plan = await Plan.findOne({ userId, goalId: goal._id }).sort({ createdAt: -1 });
  if (!plan) {
    return { plan: null, tasks: [] };
  }

  const tasks = await PlanTask.find({ userId, planId: plan._id }).sort({ priority: -1, scheduledFor: 1 });
  return {
    plan: {
      id: String(plan._id),
      goalId: String(plan.goalId),
      userId: plan.userId,
      startDate: plan.startDate,
      endDate: plan.endDate,
      status: plan.status,
    },
    tasks: tasks.map((task) => ({
      id: String(task._id),
      taskType: task.taskType,
      title: task.title,
      description: task.description,
      priority: task.priority,
      estimatedMinutes: task.estimatedMinutes,
      scheduledFor: task.scheduledFor,
      status: task.status,
      source: task.source,
      reason: task.reason,
      conceptId: task.conceptId ? String(task.conceptId) : null,
      recallAttemptId: task.recallAttemptId ? String(task.recallAttemptId) : null,
    })),
  };
}

export async function getTodayPlan(userId: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  await PlanTask.updateMany(
    { userId, status: "planned", scheduledFor: { $lt: start } },
    { $set: { status: "missed" } },
  );

  const tasks = await PlanTask.find({
    userId,
    scheduledFor: { $gte: start, $lte: end },
  }).sort({ priority: -1, scheduledFor: 1 });

  if (tasks.length > 0) {
    return {
      plan: { generatedAt: new Date().toISOString() },
      tasks: tasks.map((task) => ({
        id: String(task._id),
        taskType: task.taskType,
        title: task.title,
        description: task.description,
        priority: task.priority,
        estimatedMinutes: task.estimatedMinutes,
        scheduledFor: task.scheduledFor,
        status: task.status,
        source: task.source,
        reason: task.reason,
        conceptId: task.conceptId ? String(task.conceptId) : null,
        recallAttemptId: task.recallAttemptId ? String(task.recallAttemptId) : null,
      })),
    };
  }

  const activeGoal = await Goal.findOne({ userId, status: "active" }).sort({ updatedAt: -1 });
  if (!activeGoal) {
    return { plan: { generatedAt: new Date().toISOString() }, tasks: [] };
  }

  const generated = await generateGoalPlan(userId, String(activeGoal._id));
  return generated;
}

export async function updatePlanTask(userId: string, taskId: string, status: "planned" | "in_progress" | "completed" | "missed") {
  const task = await PlanTask.findById(taskId);
  if (!task) throw notFound("Plan task not found", "PLAN_TASK_NOT_FOUND");
  if (task.userId !== userId) throw new AppError("You do not have access to this resource", 403, "FORBIDDEN");
  task.status = status;
  await task.save();
  return { id: String(task._id), status: task.status };
}

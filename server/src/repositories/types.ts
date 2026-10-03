export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoalRecord {
  id: string;
  userId: string;
  title: string;
  description: string;
  goalType: string;
  targetDate: Date | null;
  weeklyTimeBudgetMinutes: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LearnerSkillRecord {
  id: string;
  userId: string;
  goalId: string;
  name: string;
  description: string;
  priority: number;
  targetMastery: number;
  currentMastery: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanRecord {
  id: string;
  userId: string;
  goalId: string;
  startDate: Date;
  endDate: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanTaskRecord {
  id: string;
  userId: string;
  planId: string;
  goalId: string | null;
  skillId: string | null;
  conceptId: string | null;
  recallAttemptId: string | null;
  taskType: string;
  title: string;
  description: string;
  priority: number;
  estimatedMinutes: number;
  scheduledFor: Date;
  status: string;
  source: string;
  reason: string;
  category: "must_do" | "recommended" | "optional";
  sequenceOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(input: { email: string; passwordHash: string; name: string }): Promise<UserRecord>;
}

export interface GoalRepository {
  create(userId: string, input: Record<string, unknown>): Promise<GoalRecord>;
  list(userId: string): Promise<GoalRecord[]>;
  findById(id: string): Promise<GoalRecord | null>;
  update(id: string, userId: string, input: Record<string, unknown>): Promise<GoalRecord | null>;
  delete(id: string, userId: string): Promise<boolean>;
}

export interface LearnerSkillRepository {
  create(userId: string, goalId: string, input: Record<string, unknown>): Promise<LearnerSkillRecord>;
  list(userId: string, goalId: string): Promise<LearnerSkillRecord[]>;
  findById(id: string): Promise<LearnerSkillRecord | null>;
  update(id: string, userId: string, input: Record<string, unknown>): Promise<LearnerSkillRecord | null>;
  delete(id: string, userId: string): Promise<boolean>;
}

export interface PlanRepository {
  upsert(userId: string, goalId: string, startDate: Date, endDate: Date, availableMinutes?: number, plannedMinutes?: number): Promise<PlanRecord>;
  findLatest(userId: string, goalId: string): Promise<PlanRecord | null>;
}

export interface PlanTaskRepository {
  replaceForPlan(userId: string, planId: string, tasks: Array<Record<string, unknown>>): Promise<void>;
  listForPlan(userId: string, planId: string): Promise<PlanTaskRecord[]>;
  listToday(userId: string, start: Date, end: Date): Promise<PlanTaskRecord[]>;
  markMissed(userId: string, before: Date): Promise<void>;
  findById(id: string): Promise<PlanTaskRecord | null>;
  updateStatus(id: string, userId: string, status: string): Promise<PlanTaskRecord | null>;
}

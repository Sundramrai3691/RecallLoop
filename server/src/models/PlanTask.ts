import mongoose, { Schema, Types } from "mongoose";

export const PLAN_TASK_TYPES = [
  "learn",
  "recall",
  "practice",
  "assessment",
  "remediation",
] as const;
export type PlanTaskType = (typeof PLAN_TASK_TYPES)[number];

export const PLAN_TASK_SOURCES = ["planner", "scheduler", "learner_model", "manual"] as const;
export type PlanTaskSource = (typeof PLAN_TASK_SOURCES)[number];

export const PLAN_TASK_STATUSES = ["planned", "in_progress", "completed", "missed"] as const;
export type PlanTaskStatus = (typeof PLAN_TASK_STATUSES)[number];

export interface PlanTaskDoc {
  userId: string;
  planId: Types.ObjectId;
  goalId?: Types.ObjectId;
  skillId?: Types.ObjectId;
  conceptId?: Types.ObjectId;
  recallAttemptId?: Types.ObjectId;
  taskType: PlanTaskType;
  title: string;
  description?: string;
  priority: number;
  estimatedMinutes: number;
  scheduledFor: Date;
  status: PlanTaskStatus;
  source: PlanTaskSource;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const planTaskSchema = new Schema<PlanTaskDoc>(
  {
    userId: { type: String, required: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: "Plan", required: true, index: true },
    goalId: { type: Schema.Types.ObjectId, ref: "Goal" },
    skillId: { type: Schema.Types.ObjectId, ref: "Skill" },
    conceptId: { type: Schema.Types.ObjectId, ref: "Concept" },
    recallAttemptId: { type: Schema.Types.ObjectId, ref: "RecallAttempt" },
    taskType: { type: String, enum: PLAN_TASK_TYPES, required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    priority: { type: Number, default: 50, min: 0, max: 100 },
    estimatedMinutes: { type: Number, default: 30, min: 0 },
    scheduledFor: { type: Date, required: true, index: true },
    status: { type: String, enum: PLAN_TASK_STATUSES, default: "planned", index: true },
    source: { type: String, enum: PLAN_TASK_SOURCES, default: "planner", index: true },
    reason: { type: String, default: "" },
  },
  { timestamps: true },
);

export const PlanTask = mongoose.model<PlanTaskDoc>("PlanTask", planTaskSchema);

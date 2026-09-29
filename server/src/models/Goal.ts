import mongoose, { Schema, Types } from "mongoose";

export const GOAL_TYPES = [
  "learning",
  "exam",
  "interview",
  "career",
  "project",
  "personal",
] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const GOAL_STATUSES = ["active", "completed", "archived"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export interface GoalDoc {
  userId: string;
  title: string;
  description?: string;
  goalType: GoalType;
  targetDate?: Date;
  weeklyTimeBudgetMinutes: number;
  status: GoalStatus;
  createdAt: Date;
  updatedAt: Date;
}

const goalSchema = new Schema<GoalDoc>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    goalType: {
      type: String,
      enum: GOAL_TYPES,
      default: "learning",
      index: true,
    },
    targetDate: { type: Date },
    weeklyTimeBudgetMinutes: { type: Number, default: 240, min: 0 },
    status: {
      type: String,
      enum: GOAL_STATUSES,
      default: "active",
      index: true,
    },
  },
  { timestamps: true },
);

export const Goal = mongoose.model<GoalDoc>("Goal", goalSchema);

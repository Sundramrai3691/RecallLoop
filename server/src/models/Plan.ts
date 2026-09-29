import mongoose, { Schema, Types } from "mongoose";

export const PLAN_STATUSES = ["draft", "active", "completed", "archived"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export interface PlanDoc {
  userId: string;
  goalId: Types.ObjectId;
  startDate: Date;
  endDate: Date;
  status: PlanStatus;
  createdAt: Date;
  updatedAt: Date;
}

const planSchema = new Schema<PlanDoc>(
  {
    userId: { type: String, required: true, index: true },
    goalId: { type: Schema.Types.ObjectId, ref: "Goal", required: true, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: PLAN_STATUSES,
      default: "draft",
      index: true,
    },
  },
  { timestamps: true },
);

export const Plan = mongoose.model<PlanDoc>("Plan", planSchema);

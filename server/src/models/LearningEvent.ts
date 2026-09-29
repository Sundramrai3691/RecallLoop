import mongoose, { Schema, Types } from "mongoose";

export const LEARNING_EVENT_TYPES = [
  "STUDY_STARTED",
  "STUDY_COMPLETED",
  "RECALL_STARTED",
  "RECALL_SUBMITTED",
  "EVALUATION_COMPLETED",
  "MISTAKE_DETECTED",
  "REVIEW_SCHEDULED",
  "PLAN_TASK_COMPLETED",
] as const;
export type LearningEventType = (typeof LEARNING_EVENT_TYPES)[number];

export interface LearningEventDoc {
  userId: string;
  type: LearningEventType;
  entityType?: string;
  entityId?: Types.ObjectId | string;
  payload?: Record<string, unknown>;
  createdAt: Date;
}

const learningEventSchema = new Schema<LearningEventDoc>(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, enum: LEARNING_EVENT_TYPES, required: true, index: true },
    entityType: { type: String },
    entityId: { type: Schema.Types.Mixed },
    payload: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const LearningEvent = mongoose.model<LearningEventDoc>("LearningEvent", learningEventSchema);

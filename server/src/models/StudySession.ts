import mongoose, { Schema } from "mongoose";

export const SOURCE_TYPES = ["manual", "notes", "url", "file"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SESSION_STATUSES = ["in_progress", "completed"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export interface StudySessionDoc {
  userId?: string;
  title: string;
  rawMaterial?: string;
  sourceType: SourceType;
  startedAt: Date;
  completedAt?: Date;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const studySessionSchema = new Schema<StudySessionDoc>(
  {
    userId: { type: String, default: "local-user", index: true },
    title: { type: String, required: true, trim: true },
    rawMaterial: { type: String, default: "" },
    sourceType: {
      type: String,
      enum: SOURCE_TYPES,
      default: "manual",
    },
    startedAt: { type: Date, default: () => new Date() },
    completedAt: { type: Date },
    status: {
      type: String,
      enum: SESSION_STATUSES,
      default: "in_progress",
      index: true,
    },
  },
  { timestamps: true },
);

export const StudySession = mongoose.model<StudySessionDoc>(
  "StudySession",
  studySessionSchema,
);

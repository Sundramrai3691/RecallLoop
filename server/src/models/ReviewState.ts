import mongoose, { Schema, Types } from "mongoose";

/**
 * Scheduler-owned document. FSRS (or another algorithm) should replace
 * interval/stability/difficulty semantics here without leaking into the LLM layer.
 *
 * This is an MVP scheduler and is not the final learning-science implementation.
 */
export const REVIEW_STATES = ["new", "learning", "review", "relearning"] as const;
export type ReviewLifecycle = (typeof REVIEW_STATES)[number];

export const REVIEW_OUTCOMES = ["again", "hard", "good", "easy"] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];

export interface ReviewStateDoc {
  userId?: string;
  conceptId: Types.ObjectId;
  state: ReviewLifecycle;
  dueAt: Date;
  intervalDays: number;
  stability: number;
  difficulty: number;
  lastRecallAt?: Date;
  lastOutcome?: ReviewOutcome;
  consecutiveSuccesses: number;
  updatedAt: Date;
  createdAt: Date;
}

const reviewStateSchema = new Schema<ReviewStateDoc>(
  {
    userId: { type: String, default: "local-user", index: true },
    conceptId: {
      type: Schema.Types.ObjectId,
      ref: "Concept",
      required: true,
      unique: true,
      index: true,
    },
    state: { type: String, enum: REVIEW_STATES, default: "new" },
    dueAt: { type: Date, required: true, index: true },
    intervalDays: { type: Number, default: 0 },
    stability: { type: Number, default: 0 },
    difficulty: { type: Number, default: 0.3 },
    lastRecallAt: { type: Date },
    lastOutcome: { type: String, enum: REVIEW_OUTCOMES },
    consecutiveSuccesses: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const ReviewState = mongoose.model<ReviewStateDoc>(
  "ReviewState",
  reviewStateSchema,
);

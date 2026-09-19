import mongoose, { Schema, Types } from "mongoose";

export const QUESTION_TYPES = [
  "explain",
  "compare",
  "application",
  "coding",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const KNOWLEDGE_POINT_STATUSES = ["correct", "partial", "missing"] as const;
export type KnowledgePointStatus = (typeof KNOWLEDGE_POINT_STATUSES)[number];

export interface KnowledgePointResult {
  point: string;
  status: KnowledgePointStatus;
  evidence: string;
  feedback: string;
}

export interface RecallEvaluation {
  overallCoverage: number;
  knowledgePointResults: KnowledgePointResult[];
  missingConcepts: string[];
  mistakes: string[];
  strengths: string[];
  feedback: string;
  suggestedRecallType: QuestionType;
  evaluatorVersion: string;
}

export interface RecallAttemptDoc {
  conceptId: Types.ObjectId;
  studySessionId: Types.ObjectId;
  question: string;
  questionType: QuestionType;
  answer?: string;
  confidence?: number;
  evaluation?: RecallEvaluation;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const evaluationSchema = new Schema<RecallEvaluation>(
  {
    overallCoverage: { type: Number, required: true },
    knowledgePointResults: [
      {
        point: { type: String, required: true },
        status: { type: String, enum: KNOWLEDGE_POINT_STATUSES, required: true },
        evidence: { type: String, default: "" },
        feedback: { type: String, default: "" },
      },
    ],
    missingConcepts: { type: [String], default: [] },
    mistakes: { type: [String], default: [] },
    strengths: { type: [String], default: [] },
    feedback: { type: String, default: "" },
    suggestedRecallType: {
      type: String,
      enum: QUESTION_TYPES,
      default: "explain",
    },
    evaluatorVersion: { type: String, required: true },
  },
  { _id: false },
);

const recallAttemptSchema = new Schema<RecallAttemptDoc>(
  {
    conceptId: { type: Schema.Types.ObjectId, ref: "Concept", required: true, index: true },
    studySessionId: {
      type: Schema.Types.ObjectId,
      ref: "StudySession",
      required: true,
      index: true,
    },
    question: { type: String, required: true },
    questionType: { type: String, enum: QUESTION_TYPES, default: "explain" },
    answer: { type: String },
    confidence: { type: Number, min: 1, max: 10 },
    evaluation: { type: evaluationSchema },
    submittedAt: { type: Date },
  },
  { timestamps: true },
);

export const RecallAttempt = mongoose.model<RecallAttemptDoc>(
  "RecallAttempt",
  recallAttemptSchema,
);

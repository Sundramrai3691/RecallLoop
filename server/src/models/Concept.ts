import mongoose, { Schema, Types } from "mongoose";

export interface ConceptDoc {
  studySessionId: Types.ObjectId;
  name: string;
  description: string;
  parentConceptId?: Types.ObjectId;
  requiredKnowledgePoints: string[];
  difficulty: number;
  mastery: number;
  createdAt: Date;
  updatedAt: Date;
}

const conceptSchema = new Schema<ConceptDoc>(
  {
    studySessionId: {
      type: Schema.Types.ObjectId,
      ref: "StudySession",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    parentConceptId: { type: Schema.Types.ObjectId, ref: "Concept" },
    requiredKnowledgePoints: { type: [String], default: [] },
    difficulty: { type: Number, default: 3, min: 1, max: 5 },
    mastery: { type: Number, default: 0, min: 0, max: 1 },
  },
  { timestamps: true },
);

export const Concept = mongoose.model<ConceptDoc>("Concept", conceptSchema);

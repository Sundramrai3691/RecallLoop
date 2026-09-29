import mongoose, { Schema, Types } from "mongoose";

export interface SkillDoc {
  userId: string;
  goalId: Types.ObjectId;
  name: string;
  description?: string;
  priority: number;
  targetMastery: number;
  currentMastery: number;
  createdAt: Date;
  updatedAt: Date;
}

const skillSchema = new Schema<SkillDoc>(
  {
    userId: { type: String, required: true, index: true },
    goalId: { type: Schema.Types.ObjectId, ref: "Goal", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    priority: { type: Number, default: 50, min: 0, max: 100 },
    targetMastery: { type: Number, default: 0.8, min: 0, max: 1 },
    currentMastery: { type: Number, default: 0.3, min: 0, max: 1 },
  },
  { timestamps: true },
);

export const Skill = mongoose.model<SkillDoc>("Skill", skillSchema);

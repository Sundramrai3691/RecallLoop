import { LearningEvent, type LearningEventDoc } from "../../models/LearningEvent.js";

export async function recordLearningEvent(input: Omit<LearningEventDoc, "createdAt">) {
  return LearningEvent.create(input);
}

import type { QuestionType } from "../../models/RecallAttempt.js";

export function buildRecallQuestion(
  conceptName: string,
  questionType: QuestionType = "explain",
): string {
  switch (questionType) {
    case "compare":
      return `Without looking at your notes, compare ${conceptName} to a closely related approach. When would you choose it?`;
    case "application":
      return `Without looking at your notes, describe a concrete situation where you would apply ${conceptName}, and walk through the steps.`;
    case "coding":
      return `Without looking at your notes, describe how you would implement ${conceptName} in code: data flow, failure cases, and key operations.`;
    case "explain":
    default:
      return `Without looking at your notes, explain how ${conceptName} works from start to finish.`;
  }
}

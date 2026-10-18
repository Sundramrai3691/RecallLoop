import { describe, expect, it } from "vitest";
import { serializeAttempt } from "./serialize.js";

describe("serializeAttempt assessment answer-key visibility", () => {
  const attempt = (submittedAt: string | null) => ({
    id: "attempt-1", conceptId: "concept-1", studySessionId: "study-1", questionType: "mcq",
    question: {
      id: "question-1", assessmentLevel: "recognition", difficulty: 2, title: "Question", context: "",
      prompt: "Choose the best answer.", estimatedMinutes: 1, options: [{ id: "a", text: "Option A" }],
      explanation: "The explanation is visible only after submission.", rubric: [{ id: "key", fullCredit: "Expected reasoning" }],
      revealedHints: [], hintsRemaining: 0,
    },
    submittedAt,
  });

  it("hides explanation and rubric before the answer is submitted", () => {
    const serialized = serializeAttempt(attempt(null)) as any;
    expect(serialized.questionData.explanation).toBeUndefined();
    expect(serialized.questionData.rubric).toBeUndefined();
    expect(serialized.questionData.options).toEqual([{ id: "a", text: "Option A" }]);
  });

  it("reveals explanation and expected reasoning after submission", () => {
    const serialized = serializeAttempt(attempt("2026-10-19T00:00:00.000Z")) as any;
    expect(serialized.questionData.explanation).toBe("The explanation is visible only after submission.");
    expect(serialized.questionData.rubric[0].fullCredit).toBe("Expected reasoning");
  });
});

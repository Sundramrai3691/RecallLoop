import { describe, expect,it } from "vitest";
import { chooseSprintCandidate } from "./sprintService.js";
import type { CanonicalQuestionCandidate } from "../questionBank/questionBankService.js";

function candidate(overrides: Partial<CanonicalQuestionCandidate> = {}): CanonicalQuestionCandidate {
  return {
    revisionId: "revision-1",
    itemSlug: "test-item",
    questionType: "rapid_recall",
    assessmentLevel: "recall",
    difficulty: 2,
    title: "Test",
    context: "",
    prompt: "Explain the test concept.",
    expectedAnswer: "A test answer.",
    rubric: [],
    estimatedMinutes: 2,
    options: null,
    correctOptionId: null,
    explanation: "Test explanation.",
    knowledgePoints: ["Test point"],
    hints: [],
    ...overrides,
  };
}

describe("chooseSprintCandidate", () => {
  it("prefers weak-point questions before weak-point-unrelated questions", () => {
    const unrelated = candidate({ revisionId:"unrelated",itemSlug:"unrelated",knowledgePoints:["Another point"] });
    const weak = candidate({ revisionId:"weak",itemSlug:"weak",questionType:"short_explanation",knowledgePoints:["Test point"] });
    expect(chooseSprintCandidate([unrelated,weak],new Set(),["Test point"])?.revisionId).toBe("weak");
  });

  it("filters recently used revisions first but still excludes coding tasks", () => {
    const coding = candidate({ revisionId:"coding",itemSlug:"coding",questionType:"coding" });
    expect(chooseSprintCandidate([coding],new Set(["coding"]))).toBe(null);
  });

  it("prefer rapid recall over multiple-choice for the bounded diagnostic", () => {
    const mcq = candidate({ revisionId:"mcq",itemSlug:"mcq",questionType:"mcq" });
    const rapid = candidate({ revisionId:"rapid",itemSlug:"rapid",questionType:"rapid_recall" });
    expect(chooseSprintCandidate([mcq,rapid],new Set())?.revisionId).toBe("rapid");
  });
});

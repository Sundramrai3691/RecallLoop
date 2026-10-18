import { describe, expect, it } from "vitest";
import { canonicalHttpPilotQuestions, pilotQuestionBenchmark } from "./pilotQuestionBank.js";
import { chooseCanonicalQuestionSet, type CanonicalQuestionCandidate } from "./questionBankService.js";
import { pilotQuestionInventory,questionContentHash,validatePilotQuestionBank } from "./questionBankQuality.js";

function candidates(): CanonicalQuestionCandidate[] {
  return canonicalHttpPilotQuestions.map((question, index) => ({
    revisionId: `revision-${index}`, itemSlug: question.slug, questionType: question.questionType, assessmentLevel: question.assessmentLevel,
    difficulty: question.difficulty, title: question.title, context: question.context, prompt: question.prompt, expectedAnswer: question.expectedAnswer,
    rubric: question.rubric, estimatedMinutes: question.estimatedMinutes, options: question.options, correctOptionId: question.correctOptionId,
    explanation: question.explanation, knowledgePoints: [question.knowledgePoint], hints: question.hints,
  }));
}

describe("canonical HTTP question pilot quality gate", () => {
  it("validates identity, canonical point, answer contract, rubric, provenance, and non-duplicate coverage", () => {
    expect(validatePilotQuestionBank()).toEqual([]);
    expect(pilotQuestionInventory()).toMatchObject({
      total: 24,
      points: { "Can distinguish freshness from validation.": 12, "Can explain method, status, headers, and body roles.": 12 },
      cognitiveLevels: { recognition: 2, recall: 6, explanation: 4, application: 4, depth: 4, transfer: 4 },
      difficulties: { "1": 4, "2": 6, "3": 4, "4": 6, "5": 4 },
      questionTypes: { mcq: 10, rapid_recall: 6, short_explanation: 2, scenario: 2, descriptive: 2, transfer: 2 },
    });
  });

  it("requires each benchmark attempt to name a bank question, expected status, and supporting rubric dimensions", () => {
    expect(pilotQuestionBenchmark).toHaveLength(6);
    for (const fixture of pilotQuestionBenchmark) {
      const question = canonicalHttpPilotQuestions.find((item) => item.slug === fixture.questionSlug)!;
      expect(fixture.answer.trim().length).toBeGreaterThan(10);
      expect(["correct", "partial", "missing"]).toContain(fixture.expectedStatus);
      expect(fixture.rubricDimensionIds.every((id) => question.rubric.some((dimension) => dimension.id === id))).toBe(true);
    }
  });

  it("makes published content hashes stable and content-sensitive", () => {
    const question = canonicalHttpPilotQuestions[0];
    expect(questionContentHash(question)).toBe(questionContentHash({ ...question }));
    expect(questionContentHash(question)).not.toBe(questionContentHash({ ...question, prompt: `${question.prompt} Changed.` }));
  });

  it("selects supported question types, avoids recent questions if alternatives exist, and reports gaps", () => {
    const pool = candidates();
    const blueprint = ["mcq", "rapid_recall", "rapid_recall", "rapid_recall", "mcq"] as const;
    const selected = chooseCanonicalQuestionSet({ candidates: pool, blueprint: [...blueprint], recentRevisionIds: new Set([pool.find((item) => item.questionType === "mcq")!.revisionId]), targetDifficulty: 3 });
    expect(selected.map((item) => item.candidate.questionType)).toEqual(blueprint);
    expect(selected.every((item) => !item.repeated)).toBe(true);
    expect(new Set(selected.map((item) => item.candidate.revisionId)).size).toBe(5);
    expect(() => chooseCanonicalQuestionSet({ candidates: pool.filter((item) => item.questionType !== "transfer"), blueprint: ["transfer"], recentRevisionIds: new Set(), targetDifficulty: 3 })).toThrow("Published question bank coverage is insufficient");
  });
});

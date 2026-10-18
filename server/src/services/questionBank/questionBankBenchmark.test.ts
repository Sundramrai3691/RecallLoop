import { describe, expect, it } from "vitest";
import { LlmEvaluator } from "../evaluator/llmEvaluator.js";
import { canonicalHttpPilotQuestions,pilotQuestionBenchmark } from "./pilotQuestionBank.js";

describe("offline canonical question rubric contract benchmark", () => {
  it.each(pilotQuestionBenchmark)("checks scripted $answerKind answer for $questionSlug", async (fixture) => {
    const question = canonicalHttpPilotQuestions.find((item) => item.slug === fixture.questionSlug)!;
    const requiredRubric = fixture.rubricDimensionIds.map((id) => question.rubric.find((dimension) => dimension.id === id)!);
    const rubric = requiredRubric.map((dimension) => `${dimension.label}: Full credit: ${dimension.fullCredit} Partial credit: ${dimension.partialCredit} Insufficient: ${dimension.insufficient}`);
    const evaluator = new LlmEvaluator({
      name: "scripted-benchmark",
      complete: async () => JSON.stringify({
        knowledgePointResults: [{ point: question.knowledgePoint, status: fixture.expectedStatus, evidence: fixture.answer, feedback: `Scripted rubric case: ${fixture.answerKind}.` }],
        missingConcepts: [], mistakes: [], strengths: [], overallCoverage: 1,
        feedback: "Scripted contract benchmark result.", suggestedRecallType: "explain",
      }),
    });
    const result = await evaluator.evaluate({
      conceptName: question.canonicalConceptName, conceptDescription: question.objective,
      requiredKnowledgePoints: [question.knowledgePoint], answer: fixture.answer, questionType: question.questionType,
      rubric, strictKnowledgePoints: true,
    });
    expect(result.knowledgePointResults[0]).toMatchObject({ point: question.knowledgePoint, status: fixture.expectedStatus });
    expect(result.overallCoverage).toBe(fixture.expectedStatus === "correct" ? 1 : fixture.expectedStatus === "partial" ? 0.5 : 0);
  });
});

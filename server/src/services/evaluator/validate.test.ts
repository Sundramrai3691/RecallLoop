import { describe, expect, it } from "vitest";
import { deriveCoverage, parseEvaluationJson } from "./validate.js";

describe("parseEvaluationJson", () => {
  it("accepts a valid rubric payload", () => {
    const parsed = parseEvaluationJson(`{
      "knowledgePointResults": [
        {
          "point": "Application checks the cache first",
          "status": "correct",
          "evidence": "checks cache first",
          "feedback": "Good"
        }
      ],
      "missingConcepts": [],
      "mistakes": [],
      "strengths": ["cache first"],
      "overallCoverage": 1,
      "feedback": "Complete",
      "suggestedRecallType": "explain"
    }`);
    expect(parsed.overallCoverage).toBe(1);
    expect(parsed.knowledgePointResults[0].status).toBe("correct");
  });

  it("strips markdown fences", () => {
    const parsed = parseEvaluationJson(`\`\`\`json
      {"knowledgePointResults":[{"point":"A","status":"missing","evidence":"","feedback":"x"}],"missingConcepts":["A"],"mistakes":[],"strengths":[],"overallCoverage":0,"feedback":"none","suggestedRecallType":"explain"}
    \`\`\``);
    expect(parsed.overallCoverage).toBe(0);
  });

  it("rejects missing knowledge points", () => {
    expect(() =>
      parseEvaluationJson(
        JSON.stringify({
          knowledgePointResults: [],
          overallCoverage: 0.5,
          feedback: "x",
          suggestedRecallType: "explain",
        }),
      ),
    ).toThrow();
  });
});

describe("deriveCoverage", () => {
  it("weights partial as half", () => {
    expect(
      deriveCoverage([
        { status: "correct" },
        { status: "partial" },
        { status: "missing" },
        { status: "correct" },
      ]),
    ).toBe(0.625);
  });
});

import { describe, expect, it } from "vitest";
import { summarizeAssessmentEvidence } from "./assessmentService.js";

describe("summarizeAssessmentEvidence", () => {
  it("counts correct, partial, incorrect, and unanswered questions accurately", () => {
    const mockQuestions = [
      { id: "q1", submittedAt: "2026-10-14T01:00:00Z", resultStatus: "correct", evaluation: { knowledgePointResults: [{ point: "Point A", status: "correct" }] } },
      { id: "q2", submittedAt: "2026-10-14T01:01:00Z", resultStatus: "partial", evaluation: { knowledgePointResults: [{ point: "Point B", status: "partial" }] } },
      { id: "q3", submittedAt: "2026-10-14T01:02:00Z", resultStatus: "incorrect", evaluation: { knowledgePointResults: [{ point: "Point C", status: "missing" }] } },
      { id: "q4", submittedAt: null, resultStatus: null, evaluation: null },
    ];

    const summary = summarizeAssessmentEvidence(mockQuestions, ["Point A", "Point B", "Point C", "Point D"], 0.45);
    expect(summary.total).toBe(4);
    expect(summary.correct).toBe(1);
    expect(summary.partial).toBe(1);
    expect(summary.incorrect).toBe(1);
    expect(summary.unanswered).toBe(1);
    expect(summary.conceptMastery).toBe(0.45);
    expect(summary.totalConceptPoints).toBe(4);
    expect(summary.uniqueAssessedPoints).toBe(3);
  });

  it("rolls up duplicate knowledge points across attempts conservatively", () => {
    // If point A is answered correctly in one question, but missing in another, conservative rollup takes missing
    const mockQuestions = [
      { id: "q1", submittedAt: "2026-10-14T01:00:00Z", resultStatus: "correct", evaluation: { knowledgePointResults: [{ point: "Cache freshness", status: "correct", feedback: "Demonstrated" }] } },
      { id: "q2", submittedAt: "2026-10-14T01:01:00Z", resultStatus: "incorrect", evaluation: { knowledgePointResults: [{ point: "Cache freshness", status: "missing", feedback: "Missed in scenario" }] } },
    ];

    const summary = summarizeAssessmentEvidence(mockQuestions, ["Cache freshness"], 0.3);
    expect(summary.uniqueAssessedPoints).toBe(1);
    expect(summary.points.missing).toHaveLength(1);
    expect(summary.points.correct).toHaveLength(0);
    expect(summary.points.missing[0].feedback).toBe("Missed in scenario");
  });

  it("assigns Early signal when fewer than 3 unique points are assessed or coverage is partial", () => {
    // Single point answered correctly (100% on that question) is an early signal, not full concept mastery
    const mockQuestions = [
      { id: "q1", submittedAt: "2026-10-14T01:00:00Z", resultStatus: "correct", evaluation: { knowledgePointResults: [{ point: "Point 1", status: "correct" }] } },
    ];

    const summary = summarizeAssessmentEvidence(mockQuestions, ["Point 1", "Point 2", "Point 3"], 0.6);
    expect(summary.uniqueAssessedPoints).toBe(1);
    expect(summary.maturityStatus).toBe("Early signal");
  });

  it("assigns Strong, Developing, or Needs work when sufficient points are assessed", () => {
    const pointsStrong = [
      { id: "q1", submittedAt: "2026-10-14T01:00:00Z", resultStatus: "correct", evaluation: { knowledgePointResults: [{ point: "P1", status: "correct" }] } },
      { id: "q2", submittedAt: "2026-10-14T01:01:00Z", resultStatus: "correct", evaluation: { knowledgePointResults: [{ point: "P2", status: "correct" }] } },
      { id: "q3", submittedAt: "2026-10-14T01:02:00Z", resultStatus: "correct", evaluation: { knowledgePointResults: [{ point: "P3", status: "correct" }] } },
    ];
    expect(summarizeAssessmentEvidence(pointsStrong, ["P1", "P2", "P3"]).maturityStatus).toBe("Strong");

    const pointsDeveloping = [
      { id: "q1", submittedAt: "2026-10-14T01:00:00Z", resultStatus: "correct", evaluation: { knowledgePointResults: [{ point: "P1", status: "correct" }] } },
      { id: "q2", submittedAt: "2026-10-14T01:01:00Z", resultStatus: "partial", evaluation: { knowledgePointResults: [{ point: "P2", status: "partial" }] } },
      { id: "q3", submittedAt: "2026-10-14T01:02:00Z", resultStatus: "incorrect", evaluation: { knowledgePointResults: [{ point: "P3", status: "missing" }] } },
    ];
    // score = (1 + 0.5 + 0) / 3 = 0.5 -> Developing
    expect(summarizeAssessmentEvidence(pointsDeveloping, ["P1", "P2", "P3"]).maturityStatus).toBe("Developing");

    const pointsNeedsWork = [
      { id: "q1", submittedAt: "2026-10-14T01:00:00Z", resultStatus: "incorrect", evaluation: { knowledgePointResults: [{ point: "P1", status: "missing" }] } },
      { id: "q2", submittedAt: "2026-10-14T01:01:00Z", resultStatus: "incorrect", evaluation: { knowledgePointResults: [{ point: "P2", status: "missing" }] } },
      { id: "q3", submittedAt: "2026-10-14T01:02:00Z", resultStatus: "incorrect", evaluation: { knowledgePointResults: [{ point: "P3", status: "missing" }] } },
    ];
    expect(summarizeAssessmentEvidence(pointsNeedsWork, ["P1", "P2", "P3"]).maturityStatus).toBe("Needs work");
  });

  it("keeps unassessed distinct from measured zero", () => {
    const unassessed = summarizeAssessmentEvidence([]);
    expect(unassessed.uniqueAssessedPoints).toBe(0);
    expect(unassessed.maturityStatus).toBe("Not assessed");
    expect(unassessed.conceptMastery).toBeNull();
  });
});

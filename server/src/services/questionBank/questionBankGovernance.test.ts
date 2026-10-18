import { describe, expect, it } from "vitest";
import { canonicalHttpPilotQuestions } from "./pilotQuestionBank.js";
import { questionContentHash } from "./questionBankQuality.js";
import {
  benchmarkAnnotationStatus,
  buildHumanBenchmarkReport,
  validateHumanBenchmark,
  validateReviewAssessment,
  type HumanBenchmarkCase,
  type HumanBenchmarkDataset,
  type ReviewAssessment,
} from "./questionBankGovernance.js";

function fixture(): HumanBenchmarkDataset {
  const question = canonicalHttpPilotQuestions.find((candidate) => candidate.questionType !== "mcq")!;
  const dimension = question.rubric[0].id;
  const item: HumanBenchmarkCase = {
    caseId: "unit-proposed-case",
    questionSlug: question.slug,
    revision: question.revision,
    contentHash: questionContentHash(question),
    canonicalPoint: question.knowledgePoint,
    answerKind: "partial",
    answer: "A concise learner answer.",
    rubricDimensionIds: [dimension],
    proposed: { rubricJudgments: { [dimension]: "partial_credit" }, expectedOutcome: "partial", rationale: "Engineering proposal only." },
    humanAnnotations: [],
    adjudication: null,
    annotationStatus: "proposed",
  };
  return { schemaVersion: 1, datasetId: "unit-fixture", description: "Synthetic unit test labels; not human review evidence.", cases: [item] };
}

describe("canonical question human review and benchmark governance", () => {
  it("requires all criteria with question-type-aware applicability before approval", () => {
    const assessment: ReviewAssessment = {
      technical_correctness: "pass", expected_answer: "pass", explanation: "not_applicable", mcq_key: "not_applicable",
      distractors: "not_applicable", rubric: "pass", point_mapping: "pass", cognitive_level_difficulty: "pass", source_attribution_license: "pass",
    };
    expect(validateReviewAssessment("short_explanation", assessment, "approved")).toEqual([]);
    expect(validateReviewAssessment("short_explanation", { ...assessment, rubric: "concern" }, "approved")).toContain("approval requires every applicable criterion to pass");
    expect(validateReviewAssessment("mcq", assessment, "approved")).toContain("mcq_key must be assessed for MCQs");
    expect(validateReviewAssessment("short_explanation", { ...assessment, extra: "pass" }, "changes_requested").join(" ")).toContain("criteria must contain exactly");
  });

  it("keeps proposals separate and blocks accuracy metrics until valid adjudicated labels exist", () => {
    const dataset = fixture();
    const report = buildHumanBenchmarkReport(dataset, canonicalHttpPilotQuestions);
    expect(report.annotationStatusCounts).toMatchObject({ proposed: 1, human_labeled: 0, adjudicated: 0 });
    expect(report.metrics.proposalAgreementWithAdjudicatedLabels).toMatchObject({ status: "blocked", rate: null });
    expect(report.metrics.modelAccuracy.status).toBe("not_measured");
    expect(validateHumanBenchmark(dataset, canonicalHttpPilotQuestions)).toEqual([]);
    dataset.cases[0].contentHash = "0".repeat(64);
    expect(validateHumanBenchmark(dataset, canonicalHttpPilotQuestions).join(" ")).toContain("content hash is stale");
    expect(buildHumanBenchmarkReport(dataset, canonicalHttpPilotQuestions).metrics.proposalAgreementWithAdjudicatedLabels.status).toBe("blocked");
  });

  it("records disagreement and accepts an independent adjudication only after two distinct human labels", () => {
    const dataset = fixture();
    const item = dataset.cases[0];
    const dimension = item.rubricDimensionIds[0];
    item.humanAnnotations = [
      { reviewerUserId: "reviewer-a", reviewedAt: "2026-10-18T00:00:00.000Z", rubricJudgments: { [dimension]: "full_credit" }, overallJudgment: "correct", rationale: "Synthetic unit label A.", ambiguityNotes: "" },
      { reviewerUserId: "reviewer-b", reviewedAt: "2026-10-18T00:01:00.000Z", rubricJudgments: { [dimension]: "insufficient" }, overallJudgment: "incorrect", rationale: "Synthetic unit label B.", ambiguityNotes: "" },
    ];
    item.annotationStatus = "needs_adjudication";
    expect(benchmarkAnnotationStatus(item)).toBe("needs_adjudication");
    item.adjudication = { reviewerUserId: "reviewer-c", reviewedAt: "2026-10-18T00:02:00.000Z", rubricJudgments: { [dimension]: "partial_credit" }, overallJudgment: "partial", rationale: "Synthetic unit adjudication.", ambiguityNotes: "" };
    item.annotationStatus = "adjudicated";
    expect(validateHumanBenchmark(dataset, canonicalHttpPilotQuestions)).toEqual([]);
    expect(buildHumanBenchmarkReport(dataset, canonicalHttpPilotQuestions).metrics.proposalAgreementWithAdjudicatedLabels).toMatchObject({ status: "measured", compared: 1 });
    item.adjudication.reviewerUserId = "reviewer-a";
    expect(validateHumanBenchmark(dataset, canonicalHttpPilotQuestions).join(" ")).toContain("adjudication requires two distinct prior reviewers");
  });
});

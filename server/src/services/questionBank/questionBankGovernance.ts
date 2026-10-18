import type { PilotQuestion } from "./pilotQuestionBank.js";
import { questionContentHash } from "./questionBankQuality.js";

export const reviewCriterionKeys = [
  "technical_correctness", "expected_answer", "explanation", "mcq_key", "distractors",
  "rubric", "point_mapping", "cognitive_level_difficulty", "source_attribution_license",
] as const;
export type ReviewCriterion = typeof reviewCriterionKeys[number];
export type CriterionDecision = "pass" | "concern" | "not_applicable";
export type ReviewDecision = "approved" | "changes_requested" | "rejected";
export type ReviewAssessment = Record<ReviewCriterion, CriterionDecision>;

export function validateReviewAssessment(questionType: string, value: unknown, decision: string): string[] {
  const issues: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["criteria must be an object"];
  const criteria = value as Record<string, unknown>;
  const keys = Object.keys(criteria).sort();
  if (keys.join("\u0000") !== [...reviewCriterionKeys].sort().join("\u0000")) issues.push(`criteria must contain exactly: ${reviewCriterionKeys.join(", ")}`);
  for (const key of reviewCriterionKeys) {
    if (!["pass", "concern", "not_applicable"].includes(String(criteria[key]))) issues.push(`${key} must be pass, concern, or not_applicable`);
  }
  const isMcq = questionType === "mcq";
  for (const key of ["mcq_key", "distractors"] as const) {
    if (isMcq && criteria[key] === "not_applicable") issues.push(`${key} must be assessed for MCQs`);
    if (!isMcq && criteria[key] !== "not_applicable") issues.push(`${key} must be not_applicable for free-response questions`);
  }
  if (isMcq && criteria.rubric !== "not_applicable") issues.push("rubric must be not_applicable for binary-graded MCQs");
  if (!isMcq && criteria.rubric === "not_applicable") issues.push("rubric must be assessed for free-response questions");
  for (const key of ["technical_correctness", "expected_answer", "point_mapping", "cognitive_level_difficulty", "source_attribution_license"] as const) {
    if (criteria[key] === "not_applicable") issues.push(`${key} must be assessed`);
  }
  if (isMcq && criteria.explanation === "not_applicable") issues.push("explanation must be assessed for MCQs");
  if (!isMcq && criteria.explanation !== "not_applicable") issues.push("explanation must be not_applicable for free-response questions; assess expected answer and rubric separately");
  if (decision === "approved" && reviewCriterionKeys.some((key) => criteria[key] !== "pass" && criteria[key] !== "not_applicable")) {
    issues.push("approval requires every applicable criterion to pass");
  }
  if (!["approved", "changes_requested", "rejected"].includes(decision)) issues.push("decision must be approved, changes_requested, or rejected");
  return issues;
}

export type RubricJudgment = "full_credit" | "partial_credit" | "insufficient" | "ambiguous";
export type BenchmarkOutcome = "correct" | "partial" | "incorrect" | "misconception" | "ambiguous";
export interface HumanBenchmarkCase {
  caseId: string;
  questionSlug: string;
  revision: number;
  contentHash: string;
  canonicalPoint: string;
  answerKind: string;
  answer: string;
  rubricDimensionIds: string[];
  proposed: { rubricJudgments: Record<string, RubricJudgment>; expectedOutcome: BenchmarkOutcome; rationale: string };
  humanAnnotations: Array<{
    reviewerUserId: string;
    reviewedAt: string;
    rubricJudgments: Record<string, RubricJudgment>;
    overallJudgment: BenchmarkOutcome;
    rationale: string;
    ambiguityNotes: string;
  }>;
  adjudication: null | {
    reviewerUserId: string;
    reviewedAt: string;
    rubricJudgments: Record<string, RubricJudgment>;
    overallJudgment: BenchmarkOutcome;
    rationale: string;
    ambiguityNotes: string;
  };
  annotationStatus?: "proposed" | "human_labeled" | "human_reviewed" | "needs_adjudication" | "adjudicated";
}
export interface HumanBenchmarkDataset {
  schemaVersion: number;
  datasetId: string;
  description: string;
  cases: HumanBenchmarkCase[];
}

const outcomes = new Set<BenchmarkOutcome>(["correct", "partial", "incorrect", "misconception", "ambiguous"]);
const rubricJudgments = new Set<RubricJudgment>(["full_credit", "partial_credit", "insufficient", "ambiguous"]);

export function benchmarkAnnotationStatus(item: HumanBenchmarkCase): "proposed" | "human_labeled" | "human_reviewed" | "needs_adjudication" | "adjudicated" {
  if (item.adjudication) return "adjudicated";
  if (item.humanAnnotations.length === 0) return "proposed";
  if (item.humanAnnotations.length === 1) return "human_labeled";
  const first = item.humanAnnotations[0];
  const agrees = item.humanAnnotations.every((annotation) => annotation.overallJudgment === first.overallJudgment &&
    item.rubricDimensionIds.every((dimension) => annotation.rubricJudgments[dimension] === first.rubricJudgments[dimension]));
  return agrees ? "human_reviewed" : "needs_adjudication";
}

export function validateHumanBenchmark(dataset: HumanBenchmarkDataset, questions: readonly PilotQuestion[]): string[] {
  const issues: string[] = [];
  if (dataset.schemaVersion !== 1 || !dataset.datasetId || !Array.isArray(dataset.cases)) issues.push("dataset: invalid schema version, ID, or cases");
  const caseIds = new Set<string>();
  for (const item of dataset.cases ?? []) {
    const prefix = item.caseId || "<missing-case-id>";
    if (!item.caseId || caseIds.has(item.caseId)) issues.push(`${prefix}: missing or duplicate case ID`);
    caseIds.add(item.caseId);
    if (item.annotationStatus && item.annotationStatus !== benchmarkAnnotationStatus(item)) issues.push(`${prefix}: annotation status does not match the recorded human labels/adjudication`);
    const question = questions.find((candidate) => candidate.slug === item.questionSlug && candidate.revision === item.revision);
    if (!question) issues.push(`${prefix}: exact question revision does not exist`);
    else {
      if (item.contentHash !== questionContentHash(question)) issues.push(`${prefix}: question content hash is stale`);
      if (item.canonicalPoint !== question.knowledgePoint) issues.push(`${prefix}: canonical point does not match question mapping`);
      if (!item.rubricDimensionIds.length || item.rubricDimensionIds.some((id) => !question.rubric.some((dimension) => dimension.id === id))) issues.push(`${prefix}: rubric references are missing or invalid`);
    }
    if (!item.answer?.trim() || !item.answerKind?.trim()) issues.push(`${prefix}: submitted answer or answer kind is missing`);
    if (!item.proposed?.rationale?.trim() || !outcomes.has(item.proposed?.expectedOutcome) || !item.rubricDimensionIds.every((id) => rubricJudgments.has(item.proposed?.rubricJudgments?.[id]))) issues.push(`${prefix}: proposed judgments or rationale are incomplete`);
    const reviewers = new Set<string>();
    for (const annotation of item.humanAnnotations ?? []) {
      if (!annotation.reviewerUserId || reviewers.has(annotation.reviewerUserId)) issues.push(`${prefix}: reviewer identity is missing or duplicated`);
      reviewers.add(annotation.reviewerUserId);
      if (!Number.isFinite(Date.parse(annotation.reviewedAt)) || !annotation.rationale?.trim() || !outcomes.has(annotation.overallJudgment) || !item.rubricDimensionIds.every((id) => rubricJudgments.has(annotation.rubricJudgments?.[id]))) issues.push(`${prefix}: human label, timestamp, rationale, or rubric judgments are incomplete`);
    }
    const adjudication = item.adjudication;
    const priorLabelsDisagree = item.humanAnnotations.length >= 2 && item.humanAnnotations.some((annotation) => annotation.overallJudgment !== item.humanAnnotations[0].overallJudgment || item.rubricDimensionIds.some((dimension) => annotation.rubricJudgments[dimension] !== item.humanAnnotations[0].rubricJudgments[dimension]));
    if (adjudication && (!priorLabelsDisagree || reviewers.size < 2 || !adjudication.reviewerUserId || reviewers.has(adjudication.reviewerUserId) || !Number.isFinite(Date.parse(adjudication.reviewedAt)) || !adjudication.rationale?.trim() || !outcomes.has(adjudication.overallJudgment) || !item.rubricDimensionIds.every((id) => rubricJudgments.has(adjudication.rubricJudgments?.[id])))) {
      issues.push(`${prefix}: adjudication requires two distinct prior reviewers and complete adjudication metadata`);
    }
  }
  return issues;
}

function exactAgreement<T>(pairs: Array<[T, T]>) {
  if (!pairs.length) return { status: "blocked" as const, compared: 0, matching: 0, rate: null as number | null };
  const matching = pairs.filter(([left, right]) => left === right).length;
  return { status: "measured" as const, compared: pairs.length, matching, rate: matching / pairs.length };
}

export function buildHumanBenchmarkReport(dataset: HumanBenchmarkDataset, questions: readonly PilotQuestion[]) {
  const validationIssues = validateHumanBenchmark(dataset, questions);
  const statuses = ["proposed", "human_labeled", "human_reviewed", "needs_adjudication", "adjudicated"] as const;
  const statusCounts = Object.fromEntries(statuses.map((status) => [status, dataset.cases.filter((item) => benchmarkAnnotationStatus(item) === status).length]));
  const pointCoverage = Object.fromEntries([...new Set(dataset.cases.map((item) => item.canonicalPoint))].sort().map((point) => [point, dataset.cases.filter((item) => item.canonicalPoint === point).length]));
  const outcomeCoverage = Object.fromEntries([...outcomes].sort().map((outcome) => [outcome, dataset.cases.filter((item) => item.proposed.expectedOutcome === outcome).length]));
  const answerKindCoverage = Object.fromEntries([...new Set(dataset.cases.map((item) => item.answerKind))].sort().map((kind) => [kind, dataset.cases.filter((item) => item.answerKind === kind).length]));
  const adjudicated = validationIssues.length ? [] : dataset.cases.filter((item) => benchmarkAnnotationStatus(item) === "adjudicated" && item.adjudication);
  const proposalAgreement = exactAgreement(adjudicated.map((item) => [item.proposed.expectedOutcome, item.adjudication!.overallJudgment]));
  const dimensions = [...new Set(adjudicated.flatMap((item) => item.rubricDimensionIds))].sort();
  const rubricAgreement = Object.fromEntries(dimensions.map((dimension) => [dimension, exactAgreement(adjudicated.filter((item) => item.rubricDimensionIds.includes(dimension)).map((item) => [item.proposed.rubricJudgments[dimension], item.adjudication!.rubricJudgments[dimension]]))]));
  const humanPairs: Array<[BenchmarkOutcome, BenchmarkOutcome]> = [];
  for (const item of dataset.cases) for (let i = 0; i < item.humanAnnotations.length; i++) for (let j = i + 1; j < item.humanAnnotations.length; j++) humanPairs.push([item.humanAnnotations[i].overallJudgment, item.humanAnnotations[j].overallJudgment]);
  const missingMetadata = dataset.cases.filter((item) => !item.proposed.rationale || !item.answer || !item.rubricDimensionIds.length).map((item) => item.caseId);
  return {
    datasetId: dataset.datasetId,
    totalCases: dataset.cases.length,
    annotationStatusCounts: statusCounts,
    coverageByQuestion: Object.fromEntries([...new Set(dataset.cases.map((item) => `${item.questionSlug}@${item.revision}`))].sort().map((key) => [key, dataset.cases.filter((item) => `${item.questionSlug}@${item.revision}` === key).length])),
    coverageByCanonicalPoint: pointCoverage,
    proposedOutcomeCoverage: outcomeCoverage,
    answerKindCoverage,
    missingMetadataCaseIds: missingMetadata,
    validationIssues,
    metrics: {
      proposalAgreementWithAdjudicatedLabels: adjudicated.length ? proposalAgreement : { ...proposalAgreement, reason: "blocked: no adjudicated human labels" },
      rubricDimensionAgreementWithAdjudicatedLabels: adjudicated.length ? rubricAgreement : { status: "blocked", reason: "no adjudicated human labels" },
      interReviewerOverallAgreement: exactAgreement(humanPairs),
      interReviewerRubricAgreement: Object.fromEntries([...new Set(dataset.cases.flatMap((item) => item.rubricDimensionIds))].sort().map((dimension) => {
        const pairs: Array<[RubricJudgment, RubricJudgment]> = [];
        for (const item of dataset.cases) if (item.rubricDimensionIds.includes(dimension)) {
          for (let left = 0; left < item.humanAnnotations.length; left++) for (let right = left + 1; right < item.humanAnnotations.length; right++) {
            pairs.push([item.humanAnnotations[left].rubricJudgments[dimension],item.humanAnnotations[right].rubricJudgments[dimension]]);
          }
        }
        return [dimension,exactAgreement(pairs)];
      })),
      modelAccuracy: { status: "not_measured", reason: "This offline command does not call a model or compare model outputs to human labels." },
    },
    measurementNote: "Proposed labels are engineering hypotheses. Only adjudicated human labels enter proposal-agreement metrics; human-label agreement is reported separately and does not establish population reliability.",
  };
}

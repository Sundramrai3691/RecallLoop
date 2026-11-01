import { describe, expect, it } from "vitest";
import dataset from "./benchmarkDataset.v1.json";
import { appendAdjudications, appendAnnotations, buildAdjudicationReport, type Annotation, type AnnotationLedger } from "./benchmarkAnnotationWorkflow.js";
import { createV2Case, renderBlindReviewerPack } from "./benchmarkReviewPacks.js";

const empty: AnnotationLedger = { schemaVersion: 1, annotations: [], adjudications: [] };
const c = dataset.cases[0];
function annotation(reviewerCode: string, classification: Annotation["classification"] = "partial", id = crypto.randomUUID()): Annotation {
  return { annotationId:id, caseId:c.caseId, sourceRevisionId:c.sourceQuestion.revisionId, sourceContentHash:c.sourceQuestion.contentHash,
    reviewerCode, domainExpertise:"DBMS engineering", annotationVersion:1, questionValidity:"valid", canonicalMappingValidity:"valid",
    referenceAnswerValidity:"valid", rubricCompleteness:"complete", classification, technicalExplanation:"The answer omits an essential condition.",
    essentialMissingConcepts:["apply the principle"], confidence:"high", reviewedAt:"2026-11-01T12:00:00.000Z" };
}

describe("independent evaluator annotation workflow", () => {
  it("creates a blind pack without label, answer category, rationale, or model output", () => {
    const rendered = renderBlindReviewerPack(c.domain, [c]);
    expect(rendered).toContain(c.sourceQuestion.revisionId);
    expect(rendered).toContain(c.learnerAnswer.text);
    expect(rendered).not.toContain(c.provisionalRationale);
    expect(rendered).not.toContain('"expectedClassification"');
    expect(rendered).not.toContain('"category"');
    expect(rendered).not.toContain('"modelOutput"');
  });
  it("keeps v1 labels only as provenance in v2, never as active labels", () => {
    const v2 = createV2Case(c,"2026-11-01",[]);
    expect(v2.expectedClassification).toBeNull();
    expect(v2.provisionalRationale).toBeNull();
    expect(v2.originalProvisionalLabel.classification).toBe(c.expectedClassification);
    expect(v2.humanAnnotations).toEqual([]);
  });
  it("rejects unknown cases and exact revision/hash mismatches", () => {
    const bad = { ...annotation("REV_AAA"), caseId:"unknown" };
    expect(appendAnnotations(empty, [bad], dataset.cases).errors.join(" ")).toContain("unknown case ID");
    const wrong = { ...annotation("REV_AAA"), sourceContentHash:"0".repeat(64) };
    expect(appendAnnotations(empty, [wrong], dataset.cases).errors.join(" ")).toContain("content hash does not match");
  });
  it("rejects invalid timestamps and fields outside the submission schema", () => {
    const malformed = { ...annotation("REV_AAA"), reviewedAt:"tomorrow", unexpected:"leak" };
    const result=appendAnnotations(empty,[malformed],dataset.cases);
    expect(result.errors.join(" ")).toContain("ISO 8601");
    expect(result.errors.join(" ")).toContain("unsupported field");
    expect(result.ledger.annotations).toHaveLength(0);
  });
  it("rejects duplicate submissions and appends immutable correction versions", () => {
    const first = annotation("REV_AAA");
    const accepted = appendAnnotations(empty, [first], dataset.cases);
    expect(accepted.errors).toEqual([]);
    expect(appendAnnotations(accepted.ledger, [first], dataset.cases).errors.join(" ")).toContain("duplicate annotation ID");
    const corrected = { ...first, annotationId:crypto.randomUUID(), annotationVersion:2, supersedesAnnotationId:first.annotationId, classification:"incorrect" as const };
    const result = appendAnnotations(accepted.ledger, [corrected], dataset.cases);
    expect(result.errors).toEqual([]);
    expect(result.ledger.annotations).toHaveLength(2);
  });
  it("requires two distinct reviewers, detects agreement/disagreement, and excludes provisional cases", () => {
    const a = annotation("REV_AAA", "partial"); const b = annotation("REV_BBB", "partial");
    const both = appendAnnotations(empty, [a,b], dataset.cases).ledger;
    const report = buildAdjudicationReport({ cases:dataset.cases }, both);
    expect(report.cases[0].status).toBe("agreement");
    expect(report.cases[0].eligibleForHumanValidatedScoring).toBe(true);
    const mismatch = appendAnnotations(empty, [a,{...b, classification:"incorrect"}], dataset.cases).ledger;
    expect(buildAdjudicationReport({cases:dataset.cases},mismatch).cases[0].status).toBe("disagreement_requires_adjudication");
    const single = appendAnnotations(empty,[a],dataset.cases).ledger;
    expect(buildAdjudicationReport({cases:dataset.cases},single).cases[0].eligibleForHumanValidatedScoring).toBe(false);
    expect(buildAdjudicationReport({cases:dataset.cases},empty).cases[0].eligibleForHumanValidatedScoring).toBe(false);
  });
  it("does not count a second version from the same reviewer as independent agreement", () => {
    const a=annotation("REV_AAA");
    const newer={...a,annotationId:crypto.randomUUID(),annotationVersion:2,supersedesAnnotationId:a.annotationId};
    const ledger=appendAnnotations(empty,[a,newer],dataset.cases).ledger;
    const row=buildAdjudicationReport({cases:dataset.cases},ledger).cases[0];
    expect(row.status).toBe("one_review_received");
    expect(row.eligibleForHumanValidatedScoring).toBe(false);
  });
  it("excludes a blank-answer stress case from production-route scoring", () => {
    const blank={...c,learnerAnswer:{...c.learnerAnswer,text:""},benchmarkUse:{productionRecallRouteEligible:false,exclusionReason:"blank answers bypass the LLM"}};
    const a=annotation("REV_AAA"), b=annotation("REV_BBB");
    const ledger=appendAnnotations(empty,[a,b],[blank]).ledger;
    const row=buildAdjudicationReport({cases:[{...blank,originalProvisionalLabel:{classification:c.expectedClassification}}]},ledger).cases[0];
    expect(row.eligibleForHumanValidatedScoring).toBe(true);
    expect(row.eligibleForProductionRouteScoring).toBe(false);
    expect(row.scoringExclusionReason).toContain("bypass");
  });
  it("requires independent adjudicator and excludes defective or unscorable cases", () => {
    const a=annotation("REV_AAA"), b=annotation("REV_BBB","incorrect");
    const ledger=appendAnnotations(empty,[a,b],dataset.cases).ledger;
    const base={adjudicationId:crypto.randomUUID(),caseId:c.caseId,sourceRevisionId:c.sourceQuestion.revisionId,sourceContentHash:c.sourceQuestion.contentHash,
      adjudicatorCode:"REV_CCC",domainExpertise:"DBMS engineering",adjudicationVersion:1,reviewedAnnotationIds:[a.annotationId,b.annotationId],decision:"unscorable" as const,
      questionValidity:"ambiguous" as const,canonicalMappingValidity:"valid" as const,referenceAnswerValidity:"incomplete" as const,rubricCompleteness:"incomplete" as const,
      rationale:"The prompt does not support one defensible classification.",confidence:"high" as const,reviewedAt:"2026-11-01T12:00:00.000Z"};
    expect(appendAdjudications(ledger,[{...base,adjudicatorCode:"REV_AAA"}],dataset.cases).errors.join(" ")).toContain("independent");
    const adjudicated=appendAdjudications(ledger,[base],dataset.cases);
    expect(adjudicated.errors).toEqual([]);
    const row=buildAdjudicationReport({cases:dataset.cases},adjudicated.ledger).cases[0];
    expect(row.status).toBe("rejected_due_to_defect");
    expect(row.eligibleForHumanValidatedScoring).toBe(false);
    const malformed=appendAdjudications(ledger,[{...base,rationale:42,reviewedAnnotationIds:[a.annotationId,a.annotationId]}],dataset.cases);
    expect(malformed.errors.join(" ")).toContain("rationale is required");
    expect(malformed.errors.join(" ")).toContain("unique independent annotation IDs");
  });
});

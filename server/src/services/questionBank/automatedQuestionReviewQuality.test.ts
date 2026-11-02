import { describe, expect, it } from "vitest";
import { canonicalHttpPilotQuestions } from "./pilotQuestionBank.js";
import { CANONICAL_QUESTION_REVIEW_ELIGIBILITY_SQL } from "./questionBankService.js";
import { AUTOMATED_SOURCE_VERIFICATION_STATUS, createAutomatedQuestionQualityChecker, reviewDecisionForIssues } from "./automatedQuestionReviewQuality.js";
import { questionContentHash } from "./questionBankQuality.js";

describe("automated question review quality gate", () => {
  const authored = canonicalHttpPilotQuestions[0];
  const row = {
    slug: authored.slug,
    content_hash: questionContentHash(authored),
    question_type: authored.questionType,
    canonical_concept_name: authored.canonicalConceptName,
    mapped_points: [{ statement: authored.knowledgePoint }],
  };

  it("propagates authored structural-validator findings into per-question review decisions", () => {
    const invalid = { ...authored, prompt: " " };
    const check = createAutomatedQuestionQualityChecker([invalid], []);
    const issues = check({ ...row, content_hash: questionContentHash(invalid) });

    expect(issues).toContain(`${authored.slug}: objective, prompt, and expected answer are required`);
    expect(reviewDecisionForIssues(issues).decision).toBe("blocked");
  });

  it("rejects canonical mapping drift even when the authored revision hash matches", () => {
    const check = createAutomatedQuestionQualityChecker([authored], []);
    const issues = check({ ...row, mapped_points: [{ statement: "A different point" }] });

    expect(issues).toContain(`${authored.slug}: canonical point mapping differs from the authored revision`);
    expect(reviewDecisionForIssues(issues).decision).toBe("rejected");
  });

  it("does not claim source verification from structural validation", () => {
    const check = createAutomatedQuestionQualityChecker([authored], []);
    expect(check(row)).toEqual([]);
    expect(reviewDecisionForIssues([]).decision).toBe("approved");
    expect(AUTOMATED_SOURCE_VERIFICATION_STATUS).toBe("unverified");
  });

  it("makes any later automated decision, including rejection, supersede an earlier approval", () => {
    expect(CANONICAL_QUESTION_REVIEW_ELIGIBILITY_SQL).toContain("later.reviewed_at,later.id");
    expect(CANONICAL_QUESTION_REVIEW_ELIGIBILITY_SQL).not.toContain("later.decision='approved'");
  });
});

import { describe, expect, it } from "vitest";
import { auditQuestionStructure, benchmarkFlagDisposition, findNearDuplicatePromptCandidates, type QuestionAuditRevision } from "./questionBankQualityAudit.js";

function completeQuestion(): QuestionAuditRevision {
  return {
    domain: "Computer Networks",
    concept_id: "concept",
    concept_name: "HTTP caching",
    canonical_concept_name: "HTTP caching",
    item_id: "item",
    slug: "http-cache",
    current_revision: 1,
    revision_id: "revision",
    revision: 1,
    question_type: "mcq",
    assessment_level: "recognition",
    difficulty: 2,
    content_hash: "0".repeat(64),
    objective: "Recognize the behavior.",
    title: "Quick check",
    prompt: "Which behavior is correct?",
    expected_answer: "A distinct correct answer.",
    rubric: [{ id: "key", label: "Correct key", weight: 1, fullCredit: "Correct", partialCredit: "Partly correct", insufficient: "Incorrect" }],
    options: [
      { id: "correct", text: "A distinct correct answer." },
      { id: "wrong-a", text: "A distinct incorrect answer." },
      { id: "wrong-b", text: "Another incorrect answer." },
      { id: "wrong-c", text: "A final incorrect answer." },
    ],
    correct_option_id: "correct",
    explanation: "This explains the key.",
    distractor_rationales: ["wrong-a", "wrong-b", "wrong-c"].map((optionId) => ({ optionId, misconception: "A misconception.", explanation: "Why it is incorrect." })),
    question_origin: "original",
    source_title: "RFC",
    source_url: "https://example.com/rfc",
    source_publisher: "Standards body",
    source_license: "Original question; source used as reference.",
    source_accessed_on: "2026-10-19",
    source_notes: "Grounding: section 1. Accessed 2026-10-19.",
    quality_status: "valid",
    review_status: "automated_reviewed",
    publication_status: "published",
    selector_eligible: true,
    mapped_points: [{ id: "point", statement: "An assessable point." }],
    latest_human_decision: null,
    latest_human_hash: null,
    latest_human_authorized: false,
    human_review_count: 0,
    latest_automated_decision: "approved",
    latest_automated_hash: "0".repeat(64),
    latest_automated_source_status: "unverified",
    automated_review_count: 1,
  };
}

describe("question-bank quality audit helpers", () => {
  it("reports similar prompts as review candidates without treating them as confirmed duplicates", () => {
    const candidates = findNearDuplicatePromptCandidates([
      { slug: "first", prompt: "Explain when a hash table lookup becomes slower." },
      { slug: "second", prompt: "Explain when a hash table lookup becomes slower!" },
      { slug: "third", prompt: "Describe how a TCP connection establishes ordered byte delivery." },
    ]);

    expect(candidates).toEqual([{ leftSlug: "first", rightSlug: "second", jaccard: 1 }]);
  });

  it("assigns explicit dispositions to every known evaluator risk category", () => {
    const flags = [
      "generic_single_criterion_rubric_requires_domain_review",
      "synthetic_control_verbatim_reference_answer_possible_label_leak",
      "contradictory_answer_expected_label_requires_review",
      "blank_answer_does_not_reach_production_llm_route_unanswered_stress_only",
      "terminology_error_relevance_and_target_mapping_require_review",
    ];

    expect(flags.map((flag) => benchmarkFlagDisposition(flag).disposition)).toEqual([
      "human_domain_review_required",
      "structural_concern",
      "human_domain_review_required",
      "structural_concern",
      "human_domain_review_required",
    ]);
  });

  it("checks source access-date consistency and keeps source inspection distinct from metadata", () => {
    const row = completeQuestion();
    expect(auditQuestionStructure(row, [])).toMatchObject({
      sourceMetadataComplete: true,
      sourceContentIndependentlyVerified: false,
      answerContractComplete: true,
      rubricComplete: true,
      authoredStructuralValidation: true,
    });
    expect(auditQuestionStructure({ ...row, source_notes: "No access date." }, []).sourceMetadataComplete).toBe(false);
  });
});

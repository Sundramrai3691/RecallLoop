import type { QuestionRevisionForReview } from "./automatedQuestionReviewQuality.js";

export interface QuestionAuditRevision extends QuestionRevisionForReview {
  domain: string;
  concept_id: string;
  concept_name: string;
  item_id: string;
  current_revision: number;
  revision_id: string;
  revision: number;
  question_type: string;
  assessment_level: string;
  difficulty: number;
  content_hash: string;
  objective: string;
  title: string;
  prompt: string;
  expected_answer: string;
  rubric: Array<{ id?: string; label?: string; weight?: number; fullCredit?: string; partialCredit?: string; insufficient?: string }> | null;
  options: Array<{ id?: string; text?: string }> | null;
  correct_option_id: string | null;
  explanation: string | null;
  distractor_rationales: Array<{ optionId?: string; misconception?: string; explanation?: string }> | null;
  question_origin: string;
  source_title: string;
  source_url: string;
  source_publisher: string;
  source_license: string;
  source_accessed_on: string | null;
  source_notes: string;
  quality_status: string;
  review_status: string;
  publication_status: string;
  selector_eligible: boolean;
  mapped_points: Array<{ id: string; statement: string }>;
  latest_human_decision: string | null;
  latest_human_hash: string | null;
  latest_human_authorized: boolean;
  human_review_count: number;
  latest_automated_decision: string | null;
  latest_automated_hash: string | null;
  latest_automated_source_status: string | null;
  automated_review_count: number;
}

export function auditQuestionStructure(
  row: QuestionAuditRevision,
  qualityIssues: string[],
) {
  const isMcq = row.question_type === "mcq";
  const options = row.options ?? [];
  const rationales = row.distractor_rationales ?? [];
  const rubric = row.rubric ?? [];
  const correctOptions = options.filter((option) => option.id === row.correct_option_id);
  const sourceAccessDate = row.source_accessed_on ?? "";
  const validSourceAccessDate = /^\d{4}-\d{2}-\d{2}$/.test(sourceAccessDate)
    && Number.isFinite(Date.parse(`${sourceAccessDate}T00:00:00Z`))
    && new Date(`${sourceAccessDate}T00:00:00Z`).toISOString().slice(0, 10) === sourceAccessDate
    && row.source_notes?.includes(`Accessed ${sourceAccessDate}`) === true;
  const sourceMetadataComplete = Boolean(
    row.source_title?.trim()
      && /^https:\/\//i.test(row.source_url ?? "")
      && row.source_publisher?.trim()
      && row.source_license?.trim()
      && validSourceAccessDate
      && row.source_notes?.trim(),
  );
  const answerContractComplete = Boolean(
    row.objective?.trim()
      && row.prompt?.trim()
      && row.expected_answer?.trim()
      && (!isMcq || (
        options.length === 4
        && new Set(options.map((option) => option.id)).size === options.length
        && new Set(options.map((option) => normalize(option.text ?? ""))).size === options.length
        && correctOptions.length === 1
        && row.explanation?.trim()
        && rationales.length === 3
        && rationales.every((rationale) => Boolean(
          rationale.optionId
            && rationale.optionId !== row.correct_option_id
            && options.some((option) => option.id === rationale.optionId)
            && rationale.misconception?.trim()
            && rationale.explanation?.trim(),
        ))
      )),
  );
  const rubricComplete = Boolean(
    rubric.length > 0
      && new Set(rubric.map((dimension) => dimension.id)).size === rubric.length
      && rubric.every((dimension) => Boolean(
        dimension.id?.trim()
          && dimension.label?.trim()
          && Number(dimension.weight) > 0
          && dimension.fullCredit?.trim()
          && dimension.partialCredit?.trim()
          && dimension.insufficient?.trim(),
      )),
  );

  return {
    sourceMetadataComplete,
    sourceContentIndependentlyVerified: false,
    answerContractComplete,
    rubricComplete,
    authoredStructuralValidation: qualityIssues.length === 0,
    authoredStructuralIssues: qualityIssues,
  };
}

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function promptSimilarity(left: string, right: string): number {
  const leftTokens = new Set(normalize(left).split(" ").filter((token) => token.length > 2));
  const rightTokens = new Set(normalize(right).split(" ").filter((token) => token.length > 2));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return intersection / Math.max(1, leftTokens.size + rightTokens.size - intersection);
}

export function findNearDuplicatePromptCandidates(
  questions: readonly { slug: string; prompt: string }[],
  threshold = 0.84,
) {
  const candidates: Array<{ leftSlug: string; rightSlug: string; jaccard: number }> = [];
  for (let right = 0; right < questions.length; right += 1) {
    for (let left = 0; left < right; left += 1) {
      const score = promptSimilarity(questions[left].prompt, questions[right].prompt);
      if (score >= threshold) {
        candidates.push({ leftSlug: questions[left].slug, rightSlug: questions[right].slug, jaccard: Number(score.toFixed(4)) });
      }
    }
  }
  return candidates;
}

export function benchmarkFlagDisposition(flag: string) {
  if (flag === "generic_single_criterion_rubric_requires_domain_review") {
    return {
      disposition: "human_domain_review_required",
      rationale: "One broad criterion cannot establish that the authored answer contract is technically sufficient; keep the proposed label provisional.",
    };
  }
  if (flag === "synthetic_control_verbatim_reference_answer_possible_label_leak") {
    return {
      disposition: "structural_concern",
      rationale: "Retain only as an explicitly synthetic exact-answer control; the flag does not prove model exposure or label leakage.",
    };
  }
  if (flag === "contradictory_answer_expected_label_requires_review") {
    return {
      disposition: "human_domain_review_required",
      rationale: "The response/reference disagreement may be useful, but the expected classification remains provisional until domain adjudication.",
    };
  }
  if (flag === "blank_answer_does_not_reach_production_llm_route_unanswered_stress_only") {
    return {
      disposition: "structural_concern",
      rationale: "Keep as an unanswered-route stress case, not evidence about live LLM grading; production submission treats blank input as unanswered.",
    };
  }
  if (flag === "terminology_error_relevance_and_target_mapping_require_review") {
    return {
      disposition: "human_domain_review_required",
      rationale: "Confirm the misconception is relevant to the mapped point and supports the proposed label; no technical defect is established by the flag alone.",
    };
  }
  return { disposition: "unclassified", rationale: "No disposition rule exists for this flag." };
}

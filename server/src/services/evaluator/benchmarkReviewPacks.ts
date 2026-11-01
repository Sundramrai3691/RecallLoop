export interface ReviewPackCase {
  caseId: string;
  domain: string;
  canonicalPoint: { conceptId: string; conceptName: string; conceptDescription: string; knowledgePointIds: string[]; knowledgePoints: string[] };
  sourceQuestion: { itemSlug: string; revisionId: string; revision: number; contentHash: string; questionType: string; title: string; context: string; prompt: string; expectedAnswer: string; rubric: unknown[]; provenance: unknown; eligibilityAtSnapshot?: unknown };
  learnerAnswer: { text: string };
}

export function toBlindReviewerCase(item: ReviewPackCase) {
  return {
    caseId: item.caseId,
    domain: item.domain,
    canonicalPoint: item.canonicalPoint,
    sourceRevision: {
      itemSlug: item.sourceQuestion.itemSlug,
      revisionId: item.sourceQuestion.revisionId,
      revision: item.sourceQuestion.revision,
      contentHash: item.sourceQuestion.contentHash,
      questionType: item.sourceQuestion.questionType,
      provenance: item.sourceQuestion.provenance,
    },
    question: { title: item.sourceQuestion.title, context: item.sourceQuestion.context, prompt: item.sourceQuestion.prompt },
    referenceAnswerContract: item.sourceQuestion.expectedAnswer,
    rubric: item.sourceQuestion.rubric,
    syntheticLearnerResponse: item.learnerAnswer.text,
    annotation: {
      questionValidity: "",
      canonicalMappingValidity: "",
      referenceAnswerValidity: "",
      rubricCompleteness: "",
      expectedClassification: "",
      technicalExplanation: "",
      essentialMissingConcepts: [],
      confidence: "",
      reviewedAt: "",
      suggestedCorrection: "",
    },
  };
}

export function renderBlindReviewerPack(domain: string, cases: ReviewPackCase[]): string {
  const body = cases.map((item) => {
    const review = toBlindReviewerCase(item);
    return `## ${review.caseId}\n\n- Domain: ${review.domain}\n- Canonical concept: ${review.canonicalPoint.conceptName} (${review.canonicalPoint.conceptId})\n- Knowledge point: ${review.canonicalPoint.knowledgePoints.join("; ")}\n- Point IDs: ${review.canonicalPoint.knowledgePointIds.join(", ")}\n- Source revision: ${review.sourceRevision.revisionId} (revision ${review.sourceRevision.revision})\n- Content hash: \`${review.sourceRevision.contentHash}\`\n- Item slug/type: ${review.sourceRevision.itemSlug} / ${review.sourceRevision.questionType}\n- Provenance: ${JSON.stringify(review.sourceRevision.provenance)}\n\n### Question\n\n**${review.question.title}**\n\n${review.question.context ? `${review.question.context}\n\n` : ""}${review.question.prompt}\n\n### Reference-answer contract\n\n${review.referenceAnswerContract}\n\n### Rubric\n\n\`\`\`json\n${JSON.stringify(review.rubric, null, 2)}\n\`\`\`\n\n### Synthetic learner response\n\n> ${review.syntheticLearnerResponse.replace(/\n/g, "\n> ")}\n\n### Independent annotation\n\n- Reviewer code:\n- Domain expertise:\n- Question validity (valid / ambiguous / incorrect):\n- Canonical mapping validity (valid / invalid):\n- Reference answer validity (valid / incomplete / incorrect):\n- Rubric completeness (complete / incomplete / incorrect):\n- Classification (correct / partial / incorrect / unscorable):\n- Technical explanation:\n- Essential missing concepts:\n- Confidence (high / medium / low):\n- Review timestamp (ISO 8601):\n- Suggested correction (optional):\n`;
  }).join("\n---\n\n");
  return `# Blind evaluator benchmark review — ${domain}\n\nReview each case without consulting the provisional label or author rationale. Return completed annotations through the documented import utility. Do not edit case content or add reviewer names/emails to a shared report; use an anonymized reviewer code.\n\n${body}`;
}

export function createV2Case(item: any, sourceVerifiedAt: string, auditFlags: string[]) {
  return {
    ...item,
    originalProvisionalLabel: {
      classification: item.expectedClassification,
      rationale: item.provisionalRationale,
      provenance: item.labelProvenance,
    },
    expectedClassification: null,
    provisionalRationale: null,
    labelProvenance: "provisional_pending_human_review",
    reviewStatus: "awaiting_independent_review",
    sourceVerification: { checkedAt: sourceVerifiedAt, status: "exact_revision_current_eligible_hash_and_mapping_verified_read_only" },
    engineeringAudit: { status: "automated_content_screen_only", flags: auditFlags, humanTechnicalReview: "pending" },
    benchmarkUse: { productionRecallRouteEligible: Boolean(item.learnerAnswer.text.trim()), exclusionReason: item.learnerAnswer.text.trim() ? null : "blank answers are handled as unanswered without an LLM call" },
    humanAnnotations: [],
    adjudication: null,
    eligibleForHumanValidatedScoring: false,
  };
}

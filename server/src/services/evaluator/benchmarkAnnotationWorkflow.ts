export type Classification = "correct" | "partial" | "incorrect" | "unscorable";
export type Annotation = {
  annotationId: string; caseId: string; sourceRevisionId: string; sourceContentHash: string;
  reviewerCode: string; domainExpertise: string; annotationVersion: number; supersedesAnnotationId?: string;
  questionValidity: "valid" | "ambiguous" | "incorrect"; canonicalMappingValidity: "valid" | "invalid";
  referenceAnswerValidity: "valid" | "incomplete" | "incorrect"; rubricCompleteness: "complete" | "incomplete" | "incorrect";
  classification: Classification; technicalExplanation: string; essentialMissingConcepts: string[];
  confidence: "high" | "medium" | "low"; reviewedAt: string; suggestedCorrection?: string;
};
export type Adjudication = {
  adjudicationId: string; caseId: string; sourceRevisionId: string; sourceContentHash: string;
  adjudicatorCode: string; domainExpertise: string; adjudicationVersion: number; supersedesAdjudicationId?: string;
  reviewedAnnotationIds: string[]; decision: Classification | "reject_question";
  questionValidity: "valid" | "ambiguous" | "incorrect"; canonicalMappingValidity: "valid" | "invalid";
  referenceAnswerValidity: "valid" | "incomplete" | "incorrect"; rubricCompleteness: "complete" | "incomplete" | "incorrect";
  rationale: string; confidence: "high" | "medium" | "low"; reviewedAt: string;
};
export type AnnotationLedger = { schemaVersion: 1; annotations: Annotation[]; adjudications: Adjudication[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLASS = new Set(["correct", "partial", "incorrect", "unscorable"]);
const CONFIDENCE = new Set(["high", "medium", "low"]);
const REVIEWER = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;
const ANNOTATION_KEYS = new Set(["annotationId","caseId","sourceRevisionId","sourceContentHash","reviewerCode","domainExpertise","annotationVersion","supersedesAnnotationId","questionValidity","canonicalMappingValidity","referenceAnswerValidity","rubricCompleteness","classification","technicalExplanation","essentialMissingConcepts","confidence","reviewedAt","suggestedCorrection"]);
const ADJUDICATION_KEYS = new Set(["adjudicationId","caseId","sourceRevisionId","sourceContentHash","adjudicatorCode","domainExpertise","adjudicationVersion","supersedesAdjudicationId","reviewedAnnotationIds","decision","questionValidity","canonicalMappingValidity","referenceAnswerValidity","rubricCompleteness","rationale","confidence","reviewedAt"]);
const isoDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const unknownKeys = (row: Record<string, unknown>, allowed: Set<string>) => Object.keys(row).filter((key) => !allowed.has(key));

function validateCommon(row: any, cases: Map<string, any>, kind: string, errors: string[]) {
  if (!row || typeof row !== "object" || Array.isArray(row)) { errors.push(`${kind}: entry must be an object.`); return undefined; }
  if (!UUID.test(row.annotationId ?? row.adjudicationId ?? "")) errors.push(`${kind}: a valid immutable ID is required.`);
  const item = cases.get(row.caseId);
  if (!item) { errors.push(`${kind}: unknown case ID ${String(row.caseId)}.`); return undefined; }
  if (row.sourceRevisionId !== item.sourceQuestion.revisionId) errors.push(`${kind}: source revision ID does not match case ${row.caseId}.`);
  if (row.sourceContentHash !== item.sourceQuestion.contentHash) errors.push(`${kind}: source content hash does not match case ${row.caseId}.`);
  if (!REVIEWER.test(row.reviewerCode ?? row.adjudicatorCode ?? "")) errors.push(`${kind}: anonymized reviewer code is missing or malformed.`);
  if (typeof (row.domainExpertise ?? "") !== "string" || (row.domainExpertise ?? "").trim().length < 3) errors.push(`${kind}: domain expertise must contain at least 3 characters.`);
  if (!isoDate(row.reviewedAt)) errors.push(`${kind}: reviewedAt must be an ISO 8601 timestamp.`);
  return item;
}

export function appendAnnotations(ledger: AnnotationLedger, incoming: unknown[], casesList: any[]) {
  const errors: string[] = [];
  const cases = new Map(casesList.map((item) => [item.caseId, item]));
  const all = [...ledger.annotations];
  const ids = new Set(all.map((item) => item.annotationId));
  const batchIds = new Set<string>();
  const batchHeads = new Map<string, Annotation>();
  for (const [index, raw] of incoming.entries()) {
    const row = raw as Annotation;
    const label = `annotation ${index + 1}`;
    const item = validateCommon(row, cases, label, errors);
    if (!item) continue;
    const extra = unknownKeys(row as any, ANNOTATION_KEYS);
    if (extra.length) errors.push(`${label}: unsupported field(s): ${extra.join(", ")}.`);
    if (ids.has(row.annotationId)) errors.push(`${label}: duplicate annotation ID; existing entries are immutable.`);
    if (batchIds.has(row.annotationId)) errors.push(`${label}: duplicate annotation ID within import.`);
    batchIds.add(row.annotationId);
    if (!Number.isInteger(row.annotationVersion) || row.annotationVersion < 1) errors.push(`${label}: annotationVersion must be a positive integer.`);
    if (!new Set(["valid", "ambiguous", "incorrect"]).has(row.questionValidity)) errors.push(`${label}: invalid questionValidity.`);
    if (!new Set(["valid", "invalid"]).has(row.canonicalMappingValidity)) errors.push(`${label}: invalid canonicalMappingValidity.`);
    if (!new Set(["valid", "incomplete", "incorrect"]).has(row.referenceAnswerValidity)) errors.push(`${label}: invalid referenceAnswerValidity.`);
    if (!new Set(["complete", "incomplete", "incorrect"]).has(row.rubricCompleteness)) errors.push(`${label}: invalid rubricCompleteness.`);
    if (!CLASS.has(row.classification)) errors.push(`${label}: invalid classification.`);
    if (typeof row.technicalExplanation !== "string" || !row.technicalExplanation.trim()) errors.push(`${label}: technical explanation is required.`);
    if (!Array.isArray(row.essentialMissingConcepts) || row.essentialMissingConcepts.some((value) => typeof value !== "string")) errors.push(`${label}: essentialMissingConcepts must be a string array.`);
    if (row.suggestedCorrection !== undefined && typeof row.suggestedCorrection !== "string") errors.push(`${label}: suggestedCorrection must be a string when supplied.`);
    if (!CONFIDENCE.has(row.confidence)) errors.push(`${label}: confidence must be high, medium, or low.`);
    const key = `${row.caseId}\0${row.reviewerCode}`;
    const prior = batchHeads.get(key) ?? all.filter((old) => old.caseId === row.caseId && old.reviewerCode === row.reviewerCode).sort((a,b)=>a.annotationVersion-b.annotationVersion).at(-1);
    if (!prior && (row.annotationVersion !== 1 || row.supersedesAnnotationId)) errors.push(`${label}: first annotation must be version 1 without a superseded ID.`);
    if (prior && (row.annotationVersion !== prior.annotationVersion + 1 || row.supersedesAnnotationId !== prior.annotationId)) errors.push(`${label}: corrections must append the next version and reference the prior annotation ID.`);
    if (ids.has(row.annotationId)) continue;
    ids.add(row.annotationId);
    if (!errors.some((entry) => entry.startsWith(`${label}:`))) { all.push(row); batchHeads.set(key, row); }
  }
  return { errors, ledger: { ...ledger, annotations: all } };
}

export function appendAdjudications(ledger: AnnotationLedger, incoming: unknown[], casesList: any[]) {
  const errors: string[] = [];
  const cases = new Map(casesList.map((item) => [item.caseId, item]));
  const all = [...ledger.adjudications];
  const ids = new Set(all.map((item) => item.adjudicationId));
  const batchIds = new Set<string>();
  const batchHeads = new Map<string, Adjudication>();
  for (const [index, raw] of incoming.entries()) {
    const row = raw as Adjudication;
    const label = `adjudication ${index + 1}`;
    const item = validateCommon(row, cases, label, errors);
    if (!item) continue;
    const extra = unknownKeys(row as any, ADJUDICATION_KEYS);
    if (extra.length) errors.push(`${label}: unsupported field(s): ${extra.join(", ")}.`);
    if (ids.has(row.adjudicationId)) errors.push(`${label}: duplicate adjudication ID; history is immutable.`);
    if (batchIds.has(row.adjudicationId)) errors.push(`${label}: duplicate adjudication ID within import.`);
    batchIds.add(row.adjudicationId);
    if (!Number.isInteger(row.adjudicationVersion) || row.adjudicationVersion < 1) errors.push(`${label}: adjudicationVersion must be a positive integer.`);
    if (!Array.isArray(row.reviewedAnnotationIds) || row.reviewedAnnotationIds.length < 2 || row.reviewedAnnotationIds.some((id) => typeof id !== "string") || new Set(row.reviewedAnnotationIds).size !== row.reviewedAnnotationIds.length) errors.push(`${label}: at least two unique independent annotation IDs are required.`);
    const reviewedIds = Array.isArray(row.reviewedAnnotationIds) ? row.reviewedAnnotationIds.filter((id): id is string => typeof id === "string") : [];
    const currentReviews = ledger.annotations.filter((a) => a.caseId === row.caseId && !ledger.annotations.some((later) => later.caseId === a.caseId && later.reviewerCode === a.reviewerCode && later.supersedesAnnotationId === a.annotationId));
    const referenced = currentReviews.filter((a) => reviewedIds.includes(a.annotationId));
    if (referenced.length < 2 || new Set(referenced.map((a) => a.reviewerCode)).size < 2) errors.push(`${label}: must cite two current annotations from distinct reviewers.`);
    if (referenced.some((a) => a.reviewerCode === row.adjudicatorCode)) errors.push(`${label}: adjudicator must be independent of both reviewers.`);
    if (!new Set([...CLASS, "reject_question"]).has(row.decision)) errors.push(`${label}: invalid adjudication decision.`);
    if (!new Set(["valid", "ambiguous", "incorrect"]).has(row.questionValidity) || !new Set(["valid", "invalid"]).has(row.canonicalMappingValidity) || !new Set(["valid", "incomplete", "incorrect"]).has(row.referenceAnswerValidity) || !new Set(["complete", "incomplete", "incorrect"]).has(row.rubricCompleteness)) errors.push(`${label}: adjudication must resolve question, mapping, reference-answer and rubric validity.`);
    if (typeof row.rationale !== "string" || !row.rationale.trim()) errors.push(`${label}: rationale is required.`);
    if (!CONFIDENCE.has(row.confidence)) errors.push(`${label}: confidence is invalid.`);
    const prior = batchHeads.get(row.caseId) ?? all.filter((old) => old.caseId === row.caseId).sort((a,b)=>a.adjudicationVersion-b.adjudicationVersion).at(-1);
    if (!prior && (row.adjudicationVersion !== 1 || row.supersedesAdjudicationId)) errors.push(`${label}: first adjudication must be version 1.`);
    if (prior && (row.adjudicationVersion !== prior.adjudicationVersion + 1 || row.supersedesAdjudicationId !== prior.adjudicationId)) errors.push(`${label}: revised adjudication must append the next version and supersede the prior ID.`);
    if (ids.has(row.adjudicationId)) continue;
    ids.add(row.adjudicationId);
    if (!errors.some((entry) => entry.startsWith(`${label}:`))) { all.push(row); batchHeads.set(row.caseId, row); }
  }
  return { errors, ledger: { ...ledger, adjudications: all } };
}

export function buildAdjudicationReport(dataset: any, ledger: AnnotationLedger) {
  return {
    datasetVersion: "recallloop-ai-evaluation-v2",
    generatedAt: new Date().toISOString(),
    humanAnnotationsReceived: ledger.annotations.length,
    humanAdjudicationsReceived: ledger.adjudications.length,
    provisionalLabelsUsedForScoring: false,
    cases: dataset.cases.map((item: any) => {
      const history = ledger.annotations.filter((a) => a.caseId === item.caseId);
      const current = history.filter((a) => !history.some((later) => later.reviewerCode === a.reviewerCode && later.supersedesAnnotationId === a.annotationId));
      const independent = new Set(current.map((a) => a.reviewerCode)).size >= 2;
      const adjudicationHistory = ledger.adjudications.filter((a) => a.caseId === item.caseId);
      const adjudication = adjudicationHistory.sort((a,b)=>a.adjudicationVersion-b.adjudicationVersion).at(-1);
      let status = "awaiting_review";
      if (adjudication) status = adjudication.decision === "reject_question" || adjudication.decision === "unscorable" || adjudication.questionValidity !== "valid" || adjudication.canonicalMappingValidity !== "valid" || adjudication.referenceAnswerValidity !== "valid" || adjudication.rubricCompleteness !== "complete" ? "rejected_due_to_defect" : "adjudicated";
      else if (!independent && current.length > 0) status = "one_review_received";
      else if (independent) {
        const labels = new Set(current.map((a) => a.classification));
        const unresolvedQuality = current.some((a) => a.questionValidity !== "valid" || a.canonicalMappingValidity !== "valid" || a.referenceAnswerValidity !== "valid" || a.rubricCompleteness !== "complete");
        status = labels.size === 1 && !unresolvedQuality ? "agreement" : "disagreement_requires_adjudication";
      }
      const latestClass = adjudication && !["reject_question", "unscorable"].includes(adjudication.decision) ? adjudication.decision : current.length >= 2 && new Set(current.map((a)=>a.classification)).size===1 ? current[0].classification : null;
      const independentQualityPass = current.every((a) => a.questionValidity === "valid" && a.canonicalMappingValidity === "valid" && a.referenceAnswerValidity === "valid" && a.rubricCompleteness === "complete");
      const eligible = (status === "agreement" || status === "adjudicated") && Boolean(latestClass) && latestClass !== "unscorable" && independentQualityPass;
      const routeEligible = eligible && item.benchmarkUse?.productionRecallRouteEligible !== false;
      return { caseId: item.caseId, provisionalClassification: item.originalProvisionalLabel?.classification ?? item.expectedClassification ?? null, status, currentAnnotations: current, annotationHistory: history, adjudication: adjudication ?? null, adjudicationHistory, humanReviewedClassification: eligible ? latestClass : null, eligibleForHumanValidatedScoring: eligible, eligibleForProductionRouteScoring: routeEligible, scoringExclusionReason: !routeEligible ? item.benchmarkUse?.exclusionReason ?? (eligible ? null : "requires two independent quality-valid reviews and resolved classification") : null };
    }),
  };
}

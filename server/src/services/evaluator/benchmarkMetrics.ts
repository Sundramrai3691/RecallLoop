export const BENCHMARK_CLASSES = ["correct", "partial", "incorrect"] as const;
export type BenchmarkClass = typeof BENCHMARK_CLASSES[number];

export function benchmarkProviderErrorCategory(error: { code?: string; status?: number; upstreamStatus?: number }): string {
  if (error.code === "LLM_OUTBOUND_BLOCKED") return "outbound_blocked";
  if (error.code === "LLM_DNS_ERROR") return "dns_error";
  if (error.code === "LLM_CONNECTION_REFUSED") return "connection_refused";
  if (error.code === "LLM_CONNECTION_TIMEOUT" || error.code === "LLM_TIMEOUT") return "connection_timeout";
  if (error.code === "LLM_TLS_ERROR") return "tls_error";
  if (error.code === "LLM_PROXY_ERROR") return "proxy_error";
  if (error.code === "LLM_AUTHENTICATION_FAILED") return "authentication_error";
  if (error.code === "LLM_ACCESS_DENIED") return "authorization_error";
  if (error.code === "LLM_QUOTA_EXHAUSTED") return "quota_exceeded";
  if (error.code === "LLM_RATE_LIMITED" || error.status === 429) return "rate_limited";
  if (error.code === "LLM_PROVIDER_FAILURE") return "upstream_server_error";
  if (error.code === "LLM_REQUEST_REJECTED") return error.upstreamStatus === 404 ? "invalid_endpoint" : "invalid_request";
  if (error.code === "LLM_INVALID_RESPONSE") return "invalid_request";
  if (error.code === "INVALID_AI_JSON") return "invalid_json_or_schema";
  if (error.code === "LLM_UNAVAILABLE") return "unknown_provider_error";
  return "unknown_provider_error";
}

export interface BenchmarkScoredCase {
  expected: BenchmarkClass;
  predicted: BenchmarkClass | null;
}

export function buildConfusionMetrics(cases: BenchmarkScoredCase[]) {
  const confusion = Object.fromEntries(BENCHMARK_CLASSES.map((label) => [label,
    Object.fromEntries(BENCHMARK_CLASSES.map((prediction) => [prediction, 0])),
  ])) as Record<BenchmarkClass, Record<BenchmarkClass, number>>;
  const expectedSupport = Object.fromEntries(BENCHMARK_CLASSES.map((label) => [label, 0])) as Record<BenchmarkClass, number>;
  const predictedSupport = Object.fromEntries(BENCHMARK_CLASSES.map((label) => [label, 0])) as Record<BenchmarkClass, number>;
  let scored = 0;
  let falseCorrect = 0;
  let nonCorrectExpected = 0;

  for (const item of cases) {
    expectedSupport[item.expected] += 1;
    if (item.expected !== "correct") nonCorrectExpected += 1;
    if (!item.predicted) continue;
    scored += 1;
    confusion[item.expected][item.predicted] += 1;
    predictedSupport[item.predicted] += 1;
    if (item.expected !== "correct" && item.predicted === "correct") falseCorrect += 1;
  }

  const perClass = Object.fromEntries(BENCHMARK_CLASSES.map((label) => {
    const truePositive = confusion[label][label];
    const precision = predictedSupport[label] ? truePositive / predictedSupport[label] : null;
    const recall = scored > 0 && expectedSupport[label] ? truePositive / expectedSupport[label] : null;
    const f1 = scored === 0 ? null : precision === null || recall === null
      ? (expectedSupport[label] ? 0 : null)
      : precision + recall === 0 ? 0 : 2 * precision * recall / (precision + recall);
    return [label, { support: expectedSupport[label], predicted: predictedSupport[label], precision, recall, f1 }];
  })) as Record<BenchmarkClass, { support: number; predicted: number; precision: number | null; recall: number | null; f1: number | null }>;
  const supportedF1 = BENCHMARK_CLASSES.map((label) => perClass[label]).filter((entry) => entry.support > 0).map((entry) => entry.f1 ?? 0);

  return {
    evaluatedCases: cases.length,
    scoredCases: scored,
    unscoredCases: cases.length - scored,
    classLabels: [...BENCHMARK_CLASSES],
    confusionMatrix: confusion,
    perClass,
    macroF1: scored > 0 && supportedF1.length ? supportedF1.reduce((sum, value) => sum + value, 0) / supportedF1.length : null,
    falseCorrect: {
      count: falseCorrect,
      denominator: nonCorrectExpected,
      rate: nonCorrectExpected ? falseCorrect / nonCorrectExpected : null,
      partialClassifiedCorrect: cases.filter((item) => item.expected === "partial" && item.predicted === "correct").length,
      incorrectClassifiedCorrect: cases.filter((item) => item.expected === "incorrect" && item.predicted === "correct").length,
    },
  };
}

export function percentile(values: number[], fraction: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(fraction * sorted.length) - 1);
  return sorted[index];
}

export function sanitizeBenchmarkText(value: string, maximumLength = 12_000): string {
  return value
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:sk|key|token|secret)[-_][A-Za-z0-9_-]{12,}\b/gi, "[REDACTED_CREDENTIAL]")
    .replace(/(api[_-]?key|authorization|access[_-]?token|refresh[_-]?token)\s*[:=]\s*[^\s,;}]+/gi, "$1=[REDACTED]")
    .slice(0, maximumLength);
}

export function validateBenchmarkDataset(value: unknown): string[] {
  const dataset = value as { datasetVersion?: unknown; schemaVersion?: unknown; cases?: unknown; sourceInventory?: { eligibleUniqueRevisionCounts?: Record<string, number> } } | null;
  const issues: string[] = [];
  if (!dataset || dataset.datasetVersion !== "recallloop-ai-evaluation-v1" || dataset.schemaVersion !== 1 || !Array.isArray(dataset.cases)) {
    return ["Dataset identity, schema version, or case array is invalid."];
  }
  if (dataset.cases.length > 35) issues.push("Dataset exceeds the 35-case / model-call cap.");
  const ids = new Set<string>();
  const revisionIds = new Set<string>();
  const domains = new Set<string>();
  const categories = new Set<string>();
  for (const [index, raw] of dataset.cases.entries()) {
    const item = raw as any;
    const prefix = item?.caseId || `case-${index + 1}`;
    if (!item?.caseId || ids.has(item.caseId)) issues.push(`${prefix}: case ID is absent or duplicated.`);
    ids.add(item?.caseId);
    if (!item?.domain || !item?.canonicalPoint?.conceptId || !Array.isArray(item?.canonicalPoint?.knowledgePoints) || !item.canonicalPoint.knowledgePoints.length) issues.push(`${prefix}: domain or canonical point mapping is incomplete.`);
    if (!item?.sourceQuestion?.revisionId || !/^[a-f0-9]{64}$/.test(item?.sourceQuestion?.contentHash ?? "")) issues.push(`${prefix}: exact source revision ID/hash is missing.`);
    if (revisionIds.has(item?.sourceQuestion?.revisionId)) issues.push(`${prefix}: question revision is reused; cases must use distinct source revisions.`);
    revisionIds.add(item?.sourceQuestion?.revisionId);
    if (item?.sourceQuestion?.questionType === "mcq") issues.push(`${prefix}: deterministic MCQs cannot be used to measure LLM grading.`);
    if (item?.sourceQuestion?.eligibilityAtSnapshot?.currentRevision !== true || item?.sourceQuestion?.eligibilityAtSnapshot?.publicationStatus !== "published" || item?.sourceQuestion?.eligibilityAtSnapshot?.qualityStatus !== "valid" || item?.sourceQuestion?.eligibilityAtSnapshot?.exactHashApproved !== true) issues.push(`${prefix}: source revision was not eligible at the recorded snapshot.`);
    if (!item?.sourceQuestion?.prompt?.trim() || !item?.sourceQuestion?.expectedAnswer?.trim() || !Array.isArray(item?.sourceQuestion?.rubric) || !item.sourceQuestion.rubric.length) issues.push(`${prefix}: source prompt, answer contract, or rubric is missing.`);
    if (typeof item?.learnerAnswer?.text !== "string" || !item?.learnerAnswer?.category) issues.push(`${prefix}: synthetic learner answer/category is missing.`);
    if (!["correct", "partial", "incorrect"].includes(item?.expectedClassification)) issues.push(`${prefix}: expected classification is invalid.`);
    if (item?.labelProvenance !== "provisional_pending_human_review" || item?.reviewStatus !== "provisional_pending_human_review") issues.push(`${prefix}: unreviewed labels must remain provisional_pending_human_review.`);
    if (!item?.provisionalRationale?.trim()) issues.push(`${prefix}: label rationale is absent.`);
    domains.add(item?.domain);
    categories.add(item?.learnerAnswer?.category);
  }
  const expectedDomains = ["Database Management Systems", "Operating Systems", "Computer Networks", "Data Structures and Algorithms", "System Design"];
  if (expectedDomains.some((domain) => !domains.has(domain))) issues.push("Dataset must cover each of the five supported SDE domains.");
  if (!categories.has("prompt_injection") || !categories.has("vague_incomplete") || !categories.has("terminology_error")) issues.push("Dataset omits a required adversarial or difficult answer category.");
  for (const domain of expectedDomains) {
    const eligible = dataset.sourceInventory?.eligibleUniqueRevisionCounts?.[domain];
    const count = (dataset.cases as any[]).filter((item) => item.domain === domain).length;
    if (count > 0 && typeof eligible === "number" && count > eligible) issues.push(`${domain}: cases exceed the recorded eligible revision inventory.`);
  }
  return issues;
}

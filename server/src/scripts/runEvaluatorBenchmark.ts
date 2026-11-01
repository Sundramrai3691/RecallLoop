import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env, isMockLlm } from "../config/env.js";
import { createLlmProvider } from "../lib/llm/createProvider.js";
import { classifyProviderConnectionFailure } from "../lib/llm/connectionFailure.js";
import { LlmEvaluator } from "../services/evaluator/llmEvaluator.js";
import { LLM_EVALUATOR_PROMPT_VERSION, LLM_EVALUATOR_SCHEMA_VERSION } from "../services/evaluator/types.js";
import { benchmarkProviderErrorCategory, buildConfusionMetrics, percentile, sanitizeBenchmarkText, validateBenchmarkDataset } from "../services/evaluator/benchmarkMetrics.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const datasetPath = path.resolve(here, "../services/evaluator/benchmarkDataset.v1.json");
const outputDir = path.resolve(here, "../../../docs/research/ai-evaluation-v1");
const MAX_CALLS = 35;
type DatasetCase = {
  caseId: string; domain: string; canonicalPoint: { conceptName: string; conceptDescription: string; knowledgePoints: string[] };
  sourceQuestion: { revisionId: string; contentHash: string; questionType: string; prompt: string; rubric: Array<{label?: string; fullCredit?: string; partialCredit?: string; insufficient?: string}> };
  learnerAnswer: { category: string; text: string }; expectedClassification: "correct" | "partial" | "incorrect";
};

function classify(coverage: number): "correct" | "partial" | "incorrect" {
  return coverage >= 0.75 ? "correct" : coverage >= 0.4 ? "partial" : "incorrect";
}
function safeError(error: unknown): string {
  const value = error as { code?: string; status?: number; upstreamStatus?: number; diagnosticCode?: string; message?: string };
  return sanitizeBenchmarkText(`${value?.code ?? "ERROR"}${value?.status ? ` HTTP ${value.status}` : ""}: ${value?.message ?? "evaluation failed"}`, 500);
}

async function main() {
  if (process.env.RECALLLOOP_LIVE_EVAL !== "1") throw new Error("Live provider calls are disabled. Set RECALLLOOP_LIVE_EVAL=1 explicitly.");
  const dataset = JSON.parse(await fs.readFile(datasetPath, "utf8")) as { datasetVersion: string; generatedAt: string; sourceInventory: unknown; cases: DatasetCase[] };
  const issues = validateBenchmarkDataset(dataset);
  if (issues.length) throw new Error(`Benchmark dataset validation failed: ${issues.join("; ")}`);
  const timestamp = new Date().toISOString();
  const stamp = timestamp.replace(/[:.]/g, "-");
  if (env.llmProvider !== "openai-compatible" || !env.llmApiKey.trim() || isMockLlm()) {
    await writeReport({ runId: stamp, startedAt: timestamp, completedAt: new Date().toISOString(), status: "not_run", stopReason: "Configured evaluator is not a keyed OpenAI-compatible provider; no mock fallback was used.", model: env.llmModel, provider: env.llmProvider, dataset, records: [] });
    return;
  }

  const records: any[] = [];
  const calls: Array<{attempt:number; startedAt:number; elapsedMs:number; status:number|null; usage?:{inputTokens:number;outputTokens:number;totalTokens:number}|null; errorCategory?:string; networkCode?:string|null}> = [];
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (callCount >= MAX_CALLS) throw new Error("Benchmark hard cap reached.");
    callCount += 1;
    const started = Date.now();
    const call = { attempt: callCount, startedAt: started, elapsedMs: 0, status: null as number|null, usage: undefined as {inputTokens:number;outputTokens:number;totalTokens:number}|null|undefined, errorCategory: undefined as string|undefined, networkCode: null as string|null };
    calls.push(call);
    try {
      const response = await originalFetch(input, init);
      call.status = response.status;
      call.elapsedMs = Date.now() - started;
      try {
        const body = await response.clone().json() as any;
        const usage = body?.usage;
        const inputTokens = Number(usage?.prompt_tokens ?? usage?.input_tokens);
        const outputTokens = Number(usage?.completion_tokens ?? usage?.output_tokens);
        const totalTokens = Number(usage?.total_tokens);
        if ([inputTokens, outputTokens].every(Number.isFinite)) call.usage = { inputTokens, outputTokens, totalTokens: Number.isFinite(totalTokens) ? totalTokens : inputTokens + outputTokens };
      } catch { /* Some providers omit usage; never infer it. */ }
      return response;
    } catch (error) {
      call.elapsedMs = Date.now() - started;
      const failure = classifyProviderConnectionFailure(error);
      call.errorCategory = failure.category;
      call.networkCode = failure.networkCode;
      throw error;
    }
  };

  const startedAt = new Date().toISOString();
  let stopReason: string | null = null;
  try {
    const evaluator = new LlmEvaluator(createLlmProvider());
    for (const item of dataset.cases) {
      const rubric = item.sourceQuestion.rubric.flatMap((criterion) => [
        criterion.label ? `${criterion.label}:` : "",
        criterion.fullCredit ? `Full credit: ${criterion.fullCredit}` : "",
        criterion.partialCredit ? `Partial credit: ${criterion.partialCredit}` : "",
        criterion.insufficient ? `Insufficient: ${criterion.insufficient}` : "",
      ]).filter(Boolean);
      const before = calls.length;
      try {
        const result = await evaluator.evaluate({
          conceptName: item.canonicalPoint.conceptName,
          conceptDescription: item.canonicalPoint.conceptDescription,
          requiredKnowledgePoints: item.canonicalPoint.knowledgePoints,
          answer: item.learnerAnswer.text,
          questionType: item.sourceQuestion.questionType as any,
          rubric,
        });
        records.push({ caseId: item.caseId, domain: item.domain, expected: item.expectedClassification, predicted: classify(result.overallCoverage), coverage: result.overallCoverage, result: sanitizeResult(result), modelOutputValidation: ["valid_json", "zod_schema_valid"], latencyMs: calls.slice(before).reduce((n, call) => n + call.elapsedMs, 0) });
      } catch (error) {
        const category = benchmarkProviderErrorCategory(error as { code?: string; status?: number; upstreamStatus?: number });
        records.push({ caseId: item.caseId, domain: item.domain, expected: item.expectedClassification, predicted: null, providerErrorCategory: category, applicationStatus: (error as {status?: number})?.status ?? null, upstreamHttpStatus: (error as {upstreamStatus?: number})?.upstreamStatus ?? null, networkErrorCode: (error as {diagnosticCode?: string})?.diagnosticCode ?? null, safeError: safeError(error), modelOutputValidation: [category], latencyMs: calls.slice(before).reduce((n, call) => n + call.elapsedMs, 0) });
        if (["authentication_error", "authorization_error", "quota_exceeded", "rate_limited", "upstream_server_error", "outbound_blocked", "dns_error", "connection_refused", "connection_timeout", "tls_error", "proxy_error", "unknown_provider_error", "invalid_endpoint"].includes(category)) {
          stopReason = `Stopped after ${category}; remaining cases were not sent.`;
          break;
        }
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
  await writeReport({
    runId: stamp, startedAt, completedAt: new Date().toISOString(), status: stopReason ? "stopped_early" : "completed", stopReason,
    provider: env.llmProvider, model: env.llmModel, dataset,
    requestCount: calls.length, selectedCaseCount: dataset.cases.length, records,
    calls: calls.map((call) => ({ attempt: call.attempt, elapsedMs: call.elapsedMs, upstreamHttpStatus: call.status, usage: call.usage ?? null, errorCategory: call.errorCategory ?? null, networkErrorCode: call.networkCode ?? null })),
  });
}

function sanitizeResult(value: unknown): unknown {
  if (typeof value === "string") return sanitizeBenchmarkText(value, 2_000);
  if (Array.isArray(value)) return value.map(sanitizeResult);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sanitizeResult(child)]));
  return value;
}

async function writeReport(input: any) {
  await fs.mkdir(outputDir, { recursive: true });
  const records = input.records as any[];
  const metrics = buildConfusionMetrics(records.map((record) => ({ expected: record.expected, predicted: record.predicted })));
  const latencies = records.map((record) => record.latencyMs).filter(Number.isFinite);
  const usages = (input.calls ?? []).map((call: any) => call.usage).filter(Boolean);
  const report = {
    benchmarkVersion: "recallloop-ai-evaluation-v1", runId: input.runId, status: input.status,
    startedAt: input.startedAt, completedAt: input.completedAt, provider: input.provider, model: input.model,
    evaluatorVersion: "recallloop-llm-eval-1.0.0", promptVersion: LLM_EVALUATOR_PROMPT_VERSION, schemaVersion: LLM_EVALUATOR_SCHEMA_VERSION,
    datasetGeneratedAt: input.dataset.generatedAt, labelStatus: "provisional_pending_human_review", independentHumanLabels: 0,
    stopReason: input.stopReason ?? null, selectedCaseCount: input.selectedCaseCount ?? input.dataset.cases.length, requestCount: input.requestCount ?? 0, maxRequestCount: MAX_CALLS,
    retryAttempts: Math.max(0, (input.requestCount ?? 0) - records.length),
    agreement: { provisionalAgreement: metrics.scoredCases ? (records.filter((r) => r.predicted && r.predicted === r.expected).length / metrics.scoredCases) : null, independentReviewedAgreement: null, note: "Provisional engineering labels are not ground truth; do not report this as model accuracy." },
    metrics: { ...metrics, validModelOutputs: records.filter((r) => r.predicted !== null).length, invalidOutputCases: records.filter((r) => (r.modelOutputValidation ?? []).includes("invalid_json_or_schema")).length, unattemptedCases: (input.selectedCaseCount ?? input.dataset.cases.length) - records.length, providerErrorCases: records.filter((r) => r.providerErrorCategory && r.providerErrorCategory !== "invalid_json_or_schema").length, medianLatencyMs: percentile(latencies, 0.5), p95LatencyMs: percentile(latencies, 0.95), providerErrorCount: records.filter((r) => r.providerErrorCategory && r.providerErrorCategory !== "invalid_json_or_schema").length, usage: usages.length ? { reportedCalls: usages.length, inputTokens: usages.reduce((s:number,u:any)=>s+u.inputTokens,0), outputTokens: usages.reduce((s:number,u:any)=>s+u.outputTokens,0), totalTokens: usages.reduce((s:number,u:any)=>s+u.totalTokens,0) } : null, cost: null },
    providerCalls: (input.calls ?? []).map((call: any) => ({ attempt: call.attempt, elapsedMs: call.elapsedMs, upstreamHttpStatus: call.upstreamHttpStatus, usage: call.usage ?? null, failureCategory: call.errorCategory ?? null, networkErrorCode: call.networkErrorCode ?? null })),
    sourceInventory: input.dataset.sourceInventory, records,
  };
  const json = JSON.stringify(report, null, 2) + "\n";
  const markdown = `# AI evaluator benchmark run ${report.runId}\n\n- Status: ${report.status}\n- Provider/model: ${report.provider ?? "not run"} / ${report.model}\n- Evaluator/prompt/schema: ${report.evaluatorVersion} / ${report.promptVersion} / ${report.schemaVersion}\n- Cases selected / provider attempts: ${report.selectedCaseCount} / ${report.requestCount} of ${MAX_CALLS}\n- Valid outputs / invalid-output cases / unattempted cases: ${report.metrics.validModelOutputs} / ${report.metrics.invalidOutputCases} / ${report.metrics.unattemptedCases}\n- Provider-error cases / retries: ${report.metrics.providerErrorCases} / ${report.retryAttempts}\n- Labels: provisional only; independent human labels: 0\n- Provisional agreement: ${report.agreement.provisionalAgreement === null ? "not available" : `${(report.agreement.provisionalAgreement * 100).toFixed(1)}%`} (not model accuracy)\n- Macro F1: ${report.metrics.macroF1 === null ? "not available" : report.metrics.macroF1.toFixed(3)}\n- False-correct: ${report.metrics.falseCorrect.count}/${report.metrics.falseCorrect.denominator}\n- Median/p95 latency: ${report.metrics.medianLatencyMs ?? "n/a"} / ${report.metrics.p95LatencyMs ?? "n/a"} ms\n- Usage: ${report.metrics.usage ? `${report.metrics.usage.totalTokens} reported tokens` : "not supplied by provider"}; cost not estimated\n- Stop reason: ${report.stopReason ?? "none"}\n\n## Confusion matrix\n\nExpected rows × predicted columns; unscored outputs are omitted from the matrix and shown separately.\n\n| Expected \\ Predicted | Correct | Partial | Incorrect |\n|---|---:|---:|---:|\n${(["correct","partial","incorrect"] as const).map((label)=>`| ${label} | ${report.metrics.confusionMatrix[label].correct} | ${report.metrics.confusionMatrix[label].partial} | ${report.metrics.confusionMatrix[label].incorrect} |`).join("\n")}\n\nUnscored: ${report.metrics.unscoredCases}.\n\n## Case outcomes\n\n| Case | Domain | Expected | Predicted | Validation / error |\n|---|---|---|---|---|\n${records.map((r)=>`| ${r.caseId} | ${r.domain} | ${r.expected} | ${r.predicted ?? "unscored"} | ${r.providerErrorCategory ?? ((r.modelOutputValidation ?? []).join(", ") || "not run")} |`).join("\n")}\n\nThis is a small synthetic benchmark with provisional labels. It measures wiring and observed behavior for this run only; it does not establish human-validated grading quality, learning effectiveness, or production reliability.\n`;
  await Promise.all([
    fs.writeFile(path.join(outputDir, `run-${input.runId}.json`), json, "utf8"),
    fs.writeFile(path.join(outputDir, `run-${input.runId}.md`), markdown, "utf8"),
    fs.writeFile(path.join(outputDir, "latest.json"), json, "utf8"),
    fs.writeFile(path.join(outputDir, "latest.md"), markdown, "utf8"),
  ]);
  process.stdout.write(`Evaluator benchmark ${report.status}: ${report.requestCount} requests; report written to docs/research/ai-evaluation-v1/latest.md\n`);
}

main().catch((error) => {
  process.stderr.write(`${safeError(error)}\n`);
  process.exitCode = 1;
});

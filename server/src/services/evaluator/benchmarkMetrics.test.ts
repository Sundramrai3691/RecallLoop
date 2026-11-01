import { describe, expect, it } from "vitest";
import { benchmarkProviderErrorCategory, buildConfusionMetrics, percentile, sanitizeBenchmarkText, validateBenchmarkDataset } from "./benchmarkMetrics.js";
import dataset from "./benchmarkDataset.v1.json";

describe("evaluator benchmark report helpers", () => {
  it("validates the 35-case, five-domain, exact-revision, non-MCQ provisional dataset", () => {
    expect(dataset.cases).toHaveLength(35);
    expect(validateBenchmarkDataset(dataset)).toEqual([]);
    const corrupted = structuredClone(dataset) as any;
    corrupted.cases[1].sourceQuestion.revisionId = corrupted.cases[0].sourceQuestion.revisionId;
    expect(validateBenchmarkDataset(corrupted).join(" ")).toContain("reused");
  });

  it("includes unscored cases in expected-class recall denominator and exposes false-correct outcomes", () => {
    const metrics = buildConfusionMetrics([
      { expected: "correct", predicted: "correct" },
      { expected: "partial", predicted: "correct" },
      { expected: "partial", predicted: null },
      { expected: "incorrect", predicted: "incorrect" },
    ]);
    expect(metrics.confusionMatrix.partial.correct).toBe(1);
    expect(metrics.perClass.partial.recall).toBe(0);
    expect(metrics.unscoredCases).toBe(1);
    expect(metrics.falseCorrect).toMatchObject({ count: 1, denominator: 3, partialClassifiedCorrect: 1, incorrectClassifiedCorrect: 0 });
  });

  it("reports nearest-rank percentiles and redacts credential-shaped text", () => {
    expect(percentile([20, 1, 10, 4], 0.5)).toBe(4);
    expect(percentile([], 0.95)).toBeNull();
    const safe = sanitizeBenchmarkText("Authorization: Bearer abcdef secret=sk_live_123456789012345");
    expect(safe).not.toContain("abcdef");
    expect(safe).not.toContain("sk_live");
  });

  it("does not present quality metrics when the provider produced no scored output", () => {
    const metrics = buildConfusionMetrics([{ expected: "correct", predicted: null }]);
    expect(metrics.macroF1).toBeNull();
    expect(metrics.perClass.correct.recall).toBeNull();
    expect(metrics.unscoredCases).toBe(1);
  });

  it.each([
    [{ code: "LLM_OUTBOUND_BLOCKED", status: 503 }, "outbound_blocked"],
    [{ code: "LLM_AUTHENTICATION_FAILED", upstreamStatus: 401 }, "authentication_error"],
    [{ code: "LLM_ACCESS_DENIED", upstreamStatus: 403 }, "authorization_error"],
    [{ code: "LLM_QUOTA_EXHAUSTED", upstreamStatus: 429 }, "quota_exceeded"],
    [{ code: "LLM_RATE_LIMITED", upstreamStatus: 429 }, "rate_limited"],
    [{ code: "LLM_PROVIDER_FAILURE", upstreamStatus: 503 }, "upstream_server_error"],
    [{ code: "LLM_REQUEST_REJECTED", upstreamStatus: 404 }, "invalid_endpoint"],
    [{ code: "LLM_REQUEST_REJECTED", upstreamStatus: 400 }, "invalid_request"],
    [{ code: "INVALID_AI_JSON" }, "invalid_json_or_schema"],
  ])("maps safe provider error %j to %s", (error, category) => {
    expect(benchmarkProviderErrorCategory(error)).toBe(category);
  });
});

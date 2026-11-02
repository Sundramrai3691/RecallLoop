import { afterEach, describe, expect, it } from "vitest";
import { performanceMetricsSnapshot, recordPerformanceMetric, resetPerformanceMetrics } from "./performanceMetrics.js";

const previous = process.env.PERFORMANCE_METRICS;
afterEach(() => { resetPerformanceMetrics(); if (previous === undefined) delete process.env.PERFORMANCE_METRICS; else process.env.PERFORMANCE_METRICS = previous; });

describe("bounded process performance metrics", () => {
  it("is opt-in and reports p99 only after one hundred samples", () => {
    delete process.env.PERFORMANCE_METRICS;
    recordPerformanceMetric("test.query", 4);
    expect(performanceMetricsSnapshot()).toEqual({});
    process.env.PERFORMANCE_METRICS = "1";
    for (let index = 1; index <= 99; index++) recordPerformanceMetric("test.query", index);
    expect(performanceMetricsSnapshot()["test.query"]).toMatchObject({ sampleCount: 99, p50Ms: 50, p95Ms: 95, p99Ms: null });
    recordPerformanceMetric("test.query", 100);
    expect(performanceMetricsSnapshot()["test.query"]).toMatchObject({ sampleCount: 100, p99Ms: 99 });
  });

  it("resets its samples and ignores non-finite durations", () => {
    process.env.PERFORMANCE_METRICS = "1";
    recordPerformanceMetric("test.query", Number.NaN);
    recordPerformanceMetric("test.query", 3);
    expect(performanceMetricsSnapshot()["test.query"].sampleCount).toBe(1);
    resetPerformanceMetrics();
    expect(performanceMetricsSnapshot()).toEqual({});
  });
});

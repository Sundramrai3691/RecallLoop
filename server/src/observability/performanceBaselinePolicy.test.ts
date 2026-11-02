import { describe, expect, it } from "vitest";
import { MAX_PERFORMANCE_DURATION_MS, MAX_PERFORMANCE_REQUESTS, summarizeDurations, validatePerformanceDatabaseUrl } from "./performanceBaselinePolicy.js";

describe("performance baseline safety policy",()=>{
  it("has explicit request and time budgets",()=>{
    expect(MAX_PERFORMANCE_REQUESTS).toBe(1200);
    expect(MAX_PERFORMANCE_DURATION_MS).toBe(120000);
  });

  it("accepts only loopback recallloop URLs",()=>{
    expect(validatePerformanceDatabaseUrl("postgres://recallloop@127.0.0.1:5432/recallloop").hostname).toBe("127.0.0.1");
    expect(()=>validatePerformanceDatabaseUrl("postgres://recallloop@example.com:5432/recallloop")).toThrow(/loopback/);
    expect(()=>validatePerformanceDatabaseUrl("postgres://recallloop@127.0.0.1:5432/other")).toThrow(/recallloop/);
    expect(()=>validatePerformanceDatabaseUrl("not a URL")).toThrow(/valid explicit/);
  });

  it("suppresses p99 when fewer than one hundred samples exist",()=>{
    expect(summarizeDurations([1,2,3])).toEqual({sampleCount:3,p50Ms:2,p95Ms:3,p99Ms:null});
    expect(summarizeDurations(Array.from({length:100},(_,index)=>index+1))).toEqual({sampleCount:100,p50Ms:50,p95Ms:95,p99Ms:99});
  });
});

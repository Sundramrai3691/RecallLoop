import { describe, expect, it } from "vitest";
import { getRequestTrace, recordPoolQuery, runWithRequestTrace } from "./requestContext.js";

describe("request telemetry context", () => {
  it("aggregates pool query time inside a request without leaking outside its async context", async () => {
    const trace = { requestId: "req-test", poolQueryCount: 0, poolQueryDurationMs: 0 };
    await runWithRequestTrace(trace, async () => {
      await Promise.resolve();
      recordPoolQuery(1.25);
      recordPoolQuery(2.75);
      expect(getRequestTrace()).toBe(trace);
    });
    expect(trace).toMatchObject({ poolQueryCount: 2, poolQueryDurationMs: 4 });
    expect(getRequestTrace()).toBeUndefined();
  });
});

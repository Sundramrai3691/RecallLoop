import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { NextFunction, Request, Response } from "express";
import { postgres } from "../db/postgres.js";
import { runWithRequestTrace, type RequestTrace } from "../observability/requestContext.js";
import { recordRequestMetric } from "../observability/performanceMetrics.js";

function safeEndpoint(req: Request): string {
  if (req.route?.path) return `${req.baseUrl}${req.route.path}`;
  return "<unmatched>";
}

export function requestTelemetry(req: Request, res: Response, next: NextFunction): void {
  // Never echo arbitrary caller data into logs; generate a correlation ID locally.
  const requestId = randomUUID();
  const trace: RequestTrace = { requestId, poolQueryCount: 0, poolQueryDurationMs: 0 };
  const started = performance.now();
  res.setHeader("X-Request-Id", requestId);
  res.once("finish", () => {
    const endpoint=safeEndpoint(req);
    const durationMs=performance.now()-started;
    recordRequestMetric(`${req.method} ${endpoint}`,res.statusCode,durationMs,trace.poolQueryCount,trace.poolQueryDurationMs);
    if (process.env.REQUEST_LOGS === "0") return;
    console.log(JSON.stringify({
      event: "http.request",
      requestId,
      method: req.method,
      endpoint,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      poolQueryCount: trace.poolQueryCount,
      poolQueryDurationMs: Number(trace.poolQueryDurationMs.toFixed(2)),
      pool: { total: postgres.totalCount, idle: postgres.idleCount, waiting: postgres.waitingCount },
    }));
  });
  runWithRequestTrace(trace, next);
}

import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestTrace {
  requestId: string;
  poolQueryCount: number;
  poolQueryDurationMs: number;
}

const context = new AsyncLocalStorage<RequestTrace>();

export function runWithRequestTrace<T>(trace: RequestTrace, callback: () => T): T {
  return context.run(trace, callback);
}

export function recordPoolQuery(durationMs: number): void {
  const trace = context.getStore();
  if (!trace) return;
  trace.poolQueryCount += 1;
  trace.poolQueryDurationMs += durationMs;
}

export function getRequestTrace(): RequestTrace | undefined {
  return context.getStore();
}

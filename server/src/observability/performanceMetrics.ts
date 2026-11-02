import { performance } from "node:perf_hooks";

const MAX_SAMPLES = 5_000;
const samples = new Map<string, number[]>();
const requests = new Map<string, Array<{durationMs:number;status:number;queryCount:number;queryDurationMs:number}>>();

export function resetPerformanceMetrics(): void {
  samples.clear();
  requests.clear();
}

export function recordRequestMetric(endpoint:string,status:number,durationMs:number,queryCount:number,queryDurationMs:number):void {
  if(process.env.PERFORMANCE_METRICS!=="1"||!Number.isFinite(durationMs))return;
  const values=requests.get(endpoint)??[];
  if(values.length<MAX_SAMPLES)values.push({durationMs:Math.max(0,durationMs),status,queryCount,queryDurationMs:Math.max(0,queryDurationMs)});
  requests.set(endpoint,values);
}

export function recordPerformanceMetric(name: string, durationMs: number): void {
  if (process.env.PERFORMANCE_METRICS !== "1" || !Number.isFinite(durationMs)) return;
  const values = samples.get(name) ?? [];
  if (values.length < MAX_SAMPLES) values.push(Math.max(0, durationMs));
  samples.set(name, values);
}

export async function measurePerformance<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const started = performance.now();
  try { return await operation(); }
  finally { recordPerformanceMetric(name, performance.now() - started); }
}

export function measureSyncPerformance<T>(name: string, operation: () => T): T {
  const started = performance.now();
  try { return operation(); }
  finally { recordPerformanceMetric(name, performance.now() - started); }
}

export function performanceMetricsSnapshot() {
  return Object.fromEntries([...samples.entries()].map(([name, values]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const percentile = (fraction: number) => sorted.length ? Number(sorted[Math.ceil(sorted.length * fraction) - 1].toFixed(2)) : null;
    return [name, { sampleCount: values.length, p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: values.length >= 100 ? percentile(0.99) : null }];
  }));
}

export function requestMetricsSnapshot() {
  return Object.fromEntries([...requests.entries()].map(([endpoint,values])=>{
    const sorted=[...values].sort((a,b)=>a.durationMs-b.durationMs);
    const percentile=(fraction:number)=>sorted.length?Number(sorted[Math.ceil(sorted.length*fraction)-1].durationMs.toFixed(2)):null;
    return [endpoint,{sampleCount:values.length,statusCounts:Object.fromEntries([...new Set(values.map(value=>value.status))].map(status=>[status,values.filter(value=>value.status===status).length])),durationMs:{p50:percentile(.5),p95:percentile(.95),p99:values.length>=100?percentile(.99):null},poolQueriesPerRequest:{p50:percentileOf(values.map(value=>value.queryCount),.5),p95:percentileOf(values.map(value=>value.queryCount),.95)},poolQueryDurationMs:{p50:percentileOf(values.map(value=>value.queryDurationMs),.5),p95:percentileOf(values.map(value=>value.queryDurationMs),.95)}}];
  }));
}

function percentileOf(input:number[],fraction:number){const sorted=[...input].sort((a,b)=>a-b);return sorted.length?Number(sorted[Math.ceil(sorted.length*fraction)-1].toFixed(2)):null;}

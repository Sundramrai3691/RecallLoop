export const MAX_PERFORMANCE_REQUESTS=1_200;
export const MAX_PERFORMANCE_DURATION_MS=120_000;

export function validatePerformanceDatabaseUrl(value:string):URL {
  let url:URL;
  try { url=new URL(value); } catch { throw new Error("DATABASE_URL must be a valid explicit PostgreSQL URL."); }
  if(!new Set(["127.0.0.1","localhost","::1"]).has(url.hostname)||url.pathname!=="/recallloop"){
    throw new Error("Performance baseline is restricted to a loopback database named recallloop.");
  }
  return url;
}

export function summarizeDurations(values:number[]) {
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
  const quantile=(fraction:number)=>sorted.length?Number(sorted[Math.ceil(sorted.length*fraction)-1].toFixed(2)):null;
  return {sampleCount:sorted.length,p50Ms:quantile(.5),p95Ms:quantile(.95),p99Ms:sorted.length>=100?quantile(.99):null};
}

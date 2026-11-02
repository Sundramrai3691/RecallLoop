import type { NextFunction, Request, Response } from "express";

type Bucket = { startedAt: number; count: number };
const MAX_RATE_LIMIT_KEYS = 5_000;

export function createProcessRateLimit(options: { limit: number; windowMs: number; scope?: string; now?: () => number }) {
  const buckets = new Map<string, Bucket>();
  const now = options.now ?? Date.now;
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${req.ip ?? req.socket.remoteAddress ?? "unknown"}:${options.scope ?? `${req.baseUrl}${req.path}`}`;
    const time = now();
    let bucket = buckets.get(key);
    if (!bucket || time - bucket.startedAt >= options.windowMs) {
      if (buckets.size >= MAX_RATE_LIMIT_KEYS) {
        for (const [entry, value] of buckets) if (time - value.startedAt >= options.windowMs) buckets.delete(entry);
      }
      if (!buckets.has(key) && buckets.size >= MAX_RATE_LIMIT_KEYS) {
        res.setHeader("Retry-After", String(Math.ceil(options.windowMs / 1000)));
        res.status(429).json({ error: "Too many requests. Wait and try again.", code: "RATE_LIMITED" });
        return;
      }
      bucket = { startedAt: time, count: 0 };
      buckets.set(key, bucket);
    }
    bucket.count++;
    if (bucket.count > options.limit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.startedAt + options.windowMs - time) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({ error: "Too many requests. Wait and try again.", code: "RATE_LIMITED" });
      return;
    }
    next();
  };
}

export function createConcurrencyLimit(maxConcurrent: number) {
  let active = 0;
  return (req: Request, res: Response, next: NextFunction): void => {
    if (active >= maxConcurrent) {
      res.setHeader("Retry-After", "2");
      res.status(503).json({ error: "Document processing is busy. Retry shortly.", code: "INGESTION_BUSY", retryable: true, retryAfterSeconds: 2 });
      return;
    }
    active++;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active = Math.max(0, active - 1);
    };
    res.once("finish", release);
    res.once("close", release);
    next();
  };
}

import { EventEmitter } from "node:events";
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createConcurrencyLimit, createProcessRateLimit } from "./boundedLimits.js";

describe("bounded abuse controls", () => {
  it("limits auth operations per socket and route, resets its window, and does not trust forwarded IP headers", async () => {
    let time = 10_000;
    const app = express();
    app.post("/api/auth/login", createProcessRateLimit({ limit: 2, windowMs: 60_000, now: () => time }), (_req, res) => res.json({ ok: true }));
    const first = await request(app).post("/api/auth/login").set("x-forwarded-for", "198.51.100.1");
    const second = await request(app).post("/api/auth/login").set("x-forwarded-for", "203.0.113.2");
    const blocked = await request(app).post("/api/auth/login").set("x-forwarded-for", "203.0.113.3");
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe("RATE_LIMITED");
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    time += 60_001;
    expect((await request(app).post("/api/auth/login")).status).toBe(200);
  });

  it("uses a stable operation scope so changing resource IDs cannot reset an expensive-operation limit", async () => {
    const app = express();
    const limiter = createProcessRateLimit({ limit: 1, windowMs: 60_000, scope: "recall-submit", now: () => 1_000 });
    app.post("/recalls/:id/submit", limiter, (_req, res) => res.sendStatus(204));
    expect((await request(app).post("/recalls/first/submit")).status).toBe(204);
    expect((await request(app).post("/recalls/second/submit")).status).toBe(429);
  });

  it("rejects excess in-flight document work and releases capacity once on response close", () => {
    const middleware = createConcurrencyLimit(1);
    const firstRes = new EventEmitter() as EventEmitter & { setHeader: ReturnType<typeof vi.fn>; status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
    firstRes.setHeader = vi.fn(); firstRes.status = vi.fn().mockReturnThis(); firstRes.json = vi.fn().mockReturnThis();
    const nextFirst = vi.fn();
    middleware({} as never, firstRes as never, nextFirst);
    const blockedRes = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const nextBlocked = vi.fn();
    middleware({} as never, blockedRes as never, nextBlocked);
    expect(blockedRes.status).toHaveBeenCalledWith(503);
    expect(blockedRes.json).toHaveBeenCalledWith(expect.objectContaining({ code: "INGESTION_BUSY", retryable: true }));
    expect(nextBlocked).not.toHaveBeenCalled();
    firstRes.emit("finish"); firstRes.emit("close");
    const nextAvailable = vi.fn();
    middleware({} as never, { once: vi.fn(), setHeader: vi.fn(), status: vi.fn(), json: vi.fn() } as never, nextAvailable);
    expect(nextAvailable).toHaveBeenCalledTimes(1);
  });
});

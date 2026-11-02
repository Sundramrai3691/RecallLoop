import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createHealthRouter } from "./health.js";

describe("liveness and readiness", () => {
  it("keeps liveness independent from PostgreSQL and reports dependency outages safely", async () => {
    const checkDatabase = vi.fn().mockRejectedValue(new Error("private database host and credentials"));
    const app = express().use("/api", createHealthRouter(checkDatabase, () => true));
    expect((await request(app).get("/api/health/live")).body).toEqual({ ok: true, service: "recallloop" });
    const ready = await request(app).get("/api/health/ready");
    expect(ready.status).toBe(503);
    expect(ready.body).toEqual({ ok: false, code: "DEPENDENCY_UNAVAILABLE" });
    expect(JSON.stringify(ready.body)).not.toContain("credentials");
    expect(checkDatabase).toHaveBeenCalledTimes(1);
  });

  it("preserves the existing health response when dependencies are ready", async () => {
    const app = express().use("/api", createHealthRouter(async () => {}, () => false));
    expect((await request(app).get("/api/health")).body).toEqual({ ok: true, mockLlm: false, service: "recallloop" });
  });
});

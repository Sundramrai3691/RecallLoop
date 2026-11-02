import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { securityHeaders } from "./securityHeaders.js";

describe("security response headers", () => {
  it("adds conservative browser protections without changing CORS or JSON behavior", async () => {
    const app = express();
    app.use(securityHeaders);
    app.get("/api/health", (_req, res) => res.json({ ok: true }));
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(response.headers["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
  });
});

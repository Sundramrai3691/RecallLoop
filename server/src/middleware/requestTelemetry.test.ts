import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { requestTelemetry } from "./requestTelemetry.js";

const previous = process.env.REQUEST_LOGS;
afterEach(() => { if (previous === undefined) delete process.env.REQUEST_LOGS; else process.env.REQUEST_LOGS = previous; });

describe("request telemetry middleware", () => {
  it("generates a fresh request ID without echoing caller-controlled values", async () => {
    process.env.REQUEST_LOGS = "0";
    const app = express();
    app.use(requestTelemetry);
    app.get("/api/records/:id", (_req, res) => res.json({ ok: true }));
    const generated = (await request(app).get("/api/records/123").set("x-request-id", "trace-42")).headers["x-request-id"];
    expect(generated).toMatch(/^[0-9a-f-]{36}$/i);
    expect(generated).not.toBe("trace-42");
  });
});

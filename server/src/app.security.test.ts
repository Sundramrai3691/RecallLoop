import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import { env } from "./config/env.js";

describe("application HTTP security boundary", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sets browser protection headers on the actual API app and allows only its configured origin", async () => {
    const app = createApp();
    const allowed = await request(app).get("/api/health/live").set("Origin", env.clientOrigin);
    expect(allowed.status).toBe(200);
    expect(allowed.headers["x-content-type-options"]).toBe("nosniff");
    expect(allowed.headers["x-frame-options"]).toBe("DENY");
    expect(allowed.headers["access-control-allow-origin"]).toBe(env.clientOrigin);

    const rejected = await request(app).get("/api/health/live").set("Origin", "https://attacker.invalid");
    expect(rejected.status).toBe(200);
    // cors emits its configured static allow-origin; a browser comparing this
    // with the attacker origin refuses access. It never reflects the caller.
    expect(rejected.headers["access-control-allow-origin"]).toBe(env.clientOrigin);
    expect(rejected.headers["access-control-allow-origin"]).not.toBe("https://attacker.invalid");
  });

  it("requires authentication on the actual learner-source route", async () => {
    const response = await request(createApp()).get("/api/grounding/sources");
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: "UNAUTHORIZED" });
  });
});

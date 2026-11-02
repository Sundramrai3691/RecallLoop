import { Router } from "express";
import { isMockLlm } from "../config/env.js";

export function createHealthRouter(checkDatabase: () => Promise<unknown>, mockLlm = isMockLlm) {
  const router = Router();
  router.get("/health/live", (_req, res) => res.json({ ok: true, service: "recallloop" }));
  router.get("/health/ready", async (_req, res) => {
    try { await checkDatabase(); res.json({ ok: true, service: "recallloop" }); }
    catch { res.status(503).json({ ok: false, code: "DEPENDENCY_UNAVAILABLE" }); }
  });
  router.get("/health", async (_req, res) => {
    try { await checkDatabase(); res.json({ ok: true, mockLlm: mockLlm(), service: "recallloop" }); }
    catch { res.status(503).json({ ok: false, code: "DEPENDENCY_UNAVAILABLE" }); }
  });
  return router;
}

export const healthRouter = createHealthRouter(async () => {
  const { query } = await import("../db/postgres.js");
  await query("SELECT 1");
}, isMockLlm);

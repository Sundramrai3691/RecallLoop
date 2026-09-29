import { Router } from "express";
import {
  createBaselineHandler,
  getBaselineHandler,
  getBaselineResultHandler,
  submitBaselineHandler,
} from "../controllers/baselineController.js";
import { requireAuth } from "../lib/auth.js";

export const baselineRouter = Router();
baselineRouter.use(requireAuth);
baselineRouter.post("/", createBaselineHandler);
baselineRouter.get("/:id", getBaselineHandler);
baselineRouter.post("/:id/submit", submitBaselineHandler);
baselineRouter.get("/:id/result", getBaselineResultHandler);

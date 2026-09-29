import { Router } from "express";
import { getTodayPlanHandler } from "../controllers/goalController.js";
import { requireAuth } from "../lib/auth.js";

export const planRouter = Router();

planRouter.use(requireAuth);
planRouter.get("/today", getTodayPlanHandler);

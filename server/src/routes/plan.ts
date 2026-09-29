import { Router } from "express";
import { getTodayPlanHandler, updatePlanTaskHandler } from "../controllers/goalController.js";
import { requireAuth } from "../lib/auth.js";

export const planRouter = Router();

planRouter.use(requireAuth);
planRouter.get("/today", getTodayPlanHandler);
planRouter.patch("/tasks/:id", updatePlanTaskHandler);

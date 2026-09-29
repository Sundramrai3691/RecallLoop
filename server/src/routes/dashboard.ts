import { Router } from "express";
import { getDashboardHandler } from "../controllers/dashboardController.js";
import { requireAuth } from "../lib/auth.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get("/", getDashboardHandler);

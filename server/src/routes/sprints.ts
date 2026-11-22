import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import {
  abandonSprintHandler,
  completeSprintHandler,
  getActiveSprintHandler,
  getSprintHandler,
  openSprintRepairHandler,
  startSprintHandler,
  startSprintVerificationHandler,
} from "../controllers/sprintController.js";

export const sprintRouter = Router();
sprintRouter.use(requireAuth);
sprintRouter.get("/active", getActiveSprintHandler);
sprintRouter.post("/", startSprintHandler);
sprintRouter.get("/:id", getSprintHandler);
sprintRouter.post("/:id/complete", completeSprintHandler);
sprintRouter.post("/:id/abandon", abandonSprintHandler);
sprintRouter.post("/:id/repair", openSprintRepairHandler);
sprintRouter.post("/:id/verify", startSprintVerificationHandler);

import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { createAssessmentHandler, getAssessmentHandler } from "../controllers/assessmentController.js";

export const assessmentRouter = Router();
assessmentRouter.use(requireAuth);
assessmentRouter.post("/",createAssessmentHandler);
assessmentRouter.get("/:id",getAssessmentHandler);

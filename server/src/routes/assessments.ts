import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { createAssessmentHandler, getAssessmentHandler, getKnowledgeCheckCoverageHandler } from "../controllers/assessmentController.js";

export const assessmentRouter = Router();
assessmentRouter.use(requireAuth);
assessmentRouter.get("/coverage",getKnowledgeCheckCoverageHandler);
assessmentRouter.post("/",createAssessmentHandler);
assessmentRouter.get("/:id",getAssessmentHandler);

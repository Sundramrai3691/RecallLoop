import { Router } from "express";
import {
  completeStudySessionHandler,
  createStudySessionHandler,
  getStudySessionHandler,
} from "../controllers/studySessionController.js";
import { requireAuth } from "../lib/auth.js";

export const studySessionRouter = Router();

studySessionRouter.use(requireAuth);

studySessionRouter.post("/", createStudySessionHandler);
studySessionRouter.get("/:id", getStudySessionHandler);
studySessionRouter.post("/:id/complete", completeStudySessionHandler);

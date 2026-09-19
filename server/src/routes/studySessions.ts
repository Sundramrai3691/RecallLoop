import { Router } from "express";
import {
  completeStudySessionHandler,
  createStudySessionHandler,
  getStudySessionHandler,
} from "../controllers/studySessionController.js";

export const studySessionRouter = Router();

studySessionRouter.post("/", createStudySessionHandler);
studySessionRouter.get("/:id", getStudySessionHandler);
studySessionRouter.post("/:id/complete", completeStudySessionHandler);

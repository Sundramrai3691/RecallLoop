import { Router } from "express";
import {
  getConceptHandler,
  listConceptsHandler,
  updateConceptReviewHandler,
} from "../controllers/conceptController.js";
import { requireAuth } from "../lib/auth.js";

export const conceptRouter = Router();

conceptRouter.use(requireAuth);

conceptRouter.get("/", listConceptsHandler);
conceptRouter.get("/:id", getConceptHandler);
conceptRouter.patch("/:id/review", updateConceptReviewHandler);

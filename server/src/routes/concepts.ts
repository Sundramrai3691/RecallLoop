import { Router } from "express";
import {
  getConceptHandler,
  listConceptsHandler,
} from "../controllers/conceptController.js";

export const conceptRouter = Router();

conceptRouter.get("/", listConceptsHandler);
conceptRouter.get("/:id", getConceptHandler);

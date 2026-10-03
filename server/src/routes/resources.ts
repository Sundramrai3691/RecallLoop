import { Router } from "express";
import { learningPackHandler, recommendResourcesHandler } from "../controllers/resourceController.js";
import { requireAuth } from "../lib/auth.js";

export const resourcesRouter = Router();
resourcesRouter.use(requireAuth);
resourcesRouter.get("/recommendations", recommendResourcesHandler);
resourcesRouter.get("/learning-pack",learningPackHandler);

import { Router } from "express";
import { getSourceHandler, ingestSourceHandler, listSourcesHandler } from "../controllers/groundingController.js";
import { requireAuth } from "../lib/auth.js";

export const groundingRouter=Router();
groundingRouter.use(requireAuth);
groundingRouter.get("/sources",listSourcesHandler);
groundingRouter.post("/sources",ingestSourceHandler);
groundingRouter.get("/sources/:id",getSourceHandler);

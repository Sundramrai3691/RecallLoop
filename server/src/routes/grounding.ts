import { Router } from "express";
import express from "express";
import { getSourceHandler, ingestPdfHandler, ingestSourceHandler, listSourcesHandler } from "../controllers/groundingController.js";
import { requireAuth } from "../lib/auth.js";

export const groundingRouter=Router();
groundingRouter.use(requireAuth);
groundingRouter.get("/sources",listSourcesHandler);
groundingRouter.post("/sources",ingestSourceHandler);
groundingRouter.post("/sources/pdf",express.raw({type:"application/pdf",limit:"10mb",inflate:false}),ingestPdfHandler);
groundingRouter.get("/sources/:id",getSourceHandler);

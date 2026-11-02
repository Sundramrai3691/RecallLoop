import { Router } from "express";
import express from "express";
import { getSourceHandler, ingestDocxHandler, ingestPdfHandler, ingestSourceHandler, listSourcesHandler } from "../controllers/groundingController.js";
import { requireAuth } from "../lib/auth.js";
import { createConcurrencyLimit } from "../middleware/boundedLimits.js";

export const groundingRouter=Router();
groundingRouter.use(requireAuth);
const sourceAdmission = createConcurrencyLimit(3);
groundingRouter.get("/sources",listSourcesHandler);
groundingRouter.post("/sources",sourceAdmission,ingestSourceHandler);
groundingRouter.post("/sources/pdf",sourceAdmission,express.raw({type:"application/pdf",limit:"10mb",inflate:false}),ingestPdfHandler);
groundingRouter.post("/sources/docx",sourceAdmission,express.raw({type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",limit:"10mb",inflate:false}),ingestDocxHandler);
groundingRouter.get("/sources/:id",getSourceHandler);

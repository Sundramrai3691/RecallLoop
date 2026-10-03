import { Router } from "express";
import { createRemediationHandler, getRemediationHandler, verifyRemediationHandler } from "../controllers/groundingController.js";
import { requireAuth } from "../lib/auth.js";

export const remediationRouter=Router();
remediationRouter.use(requireAuth);
remediationRouter.post("/from-attempt/:attemptId",createRemediationHandler);
remediationRouter.get("/:id",getRemediationHandler);
remediationRouter.post("/:id/verify",verifyRemediationHandler);

import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { getSettingsHandler, updateSettingsHandler } from "../controllers/settingsController.js";

export const settingsRouter = Router();
settingsRouter.use(requireAuth);
settingsRouter.get("/",getSettingsHandler);
settingsRouter.patch("/",updateSettingsHandler);

import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../lib/auth.js";
import { getSettings, updateSettings } from "../services/settings/settingsService.js";

export async function getSettingsHandler(req: AuthenticatedRequest,res: Response,next: NextFunction) { try { res.json(await getSettings(req.user!.id)); } catch (error) { next(error); } }
export async function updateSettingsHandler(req: AuthenticatedRequest,res: Response,next: NextFunction) { try { res.json(await updateSettings(req.user!.id,req.body ?? {})); } catch (error) { next(error); } }

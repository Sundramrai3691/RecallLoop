import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../lib/auth.js";
import { getDashboard } from "../services/dashboard/dashboardService.js";

export async function getDashboardHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const dashboard = await getDashboard(req.user!.id);
    res.json(dashboard);
  } catch (err) {
    next(err);
  }
}

import type { NextFunction, Request, Response } from "express";
import { getDashboard } from "../services/dashboard/dashboardService.js";

export async function getDashboardHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const dashboard = await getDashboard();
    res.json(dashboard);
  } catch (err) {
    next(err);
  }
}

import type { NextFunction, Response } from "express";
import { AppError } from "../utils/errors.js";
import type { AuthenticatedRequest } from "../lib/auth.js";

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new AppError("Authentication required", 401, "UNAUTHORIZED"));
    return;
  }
  next();
}

export function requireOwnership(userId: string, req: AuthenticatedRequest): void {
  if (!req.user) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }
  if (req.user.id !== userId) {
    throw new AppError("You do not have access to this resource", 403, "FORBIDDEN");
  }
}

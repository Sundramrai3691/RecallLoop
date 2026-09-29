import type { NextFunction, Request, Response } from "express";
import { loginUser, registerUser, getCurrentUser } from "../services/auth/authService.js";
import type { AuthenticatedRequest } from "../lib/auth.js";

export async function registerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await registerUser(req.body ?? {});
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function loginHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await loginUser(req.body ?? {});
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function meHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required", code: "UNAUTHORIZED" });
      return;
    }
    const result = await getCurrentUser(req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function logoutHandler(_req: Request, res: Response): Promise<void> {
  res.json({ ok: true, message: "Logged out" });
}

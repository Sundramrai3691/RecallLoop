import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

const secret = env.jwtSecret || "recallloop-dev-secret-change-me";

export function signToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
    },
    secret as string,
    { expiresIn: env.jwtExpiresIn as any },
  );
}

export function verifyToken(token: string): AuthUser {
  try {
    const payload = jwt.verify(token, secret) as { sub?: string; email?: string; name?: string };
    if (!payload.sub || !payload.email) {
      throw new AppError("Invalid token payload", 401, "UNAUTHORIZED");
    }
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name ?? "Learner",
    };
  } catch {
    throw new AppError("Invalid or expired token", 401, "UNAUTHORIZED");
  }
}

export function getBearerToken(headerValue?: string): string | null {
  if (!headerValue) return null;
  const match = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
  return match ? match[1] : null;
}

export function requireAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void {
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    next(new AppError("Authentication required", 401, "UNAUTHORIZED"));
    return;
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

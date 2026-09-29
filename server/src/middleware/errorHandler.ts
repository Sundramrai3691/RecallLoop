import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/errors.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }

  const message = err instanceof Error ? err.message : "Unexpected error";
  const databaseError = err as { code?: string };
  const isDatabaseFailure = databaseError.code === "ECONNREFUSED" || ["22P02", "23503", "23505"].includes(databaseError.code ?? "");

  res.status(isDatabaseFailure ? 503 : 500).json({
    error: isDatabaseFailure
      ? "Database is unavailable. Start PostgreSQL and retry."
      : "Internal server error",
    code: isDatabaseFailure ? "DATABASE_FAILURE" : "INTERNAL_ERROR",
  });
}

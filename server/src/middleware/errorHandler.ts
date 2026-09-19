import type { NextFunction, Request, Response } from "express";
import { Error as MongooseError } from "mongoose";
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

  if (err instanceof MongooseError.CastError) {
    res.status(404).json({ error: "Invalid id", code: "NOT_FOUND" });
    return;
  }

  const message = err instanceof Error ? err.message : "Unexpected error";
  const isMongo =
    typeof message === "string" &&
    /mongo|econnrefused|failed to connect/i.test(message);

  res.status(isMongo ? 503 : 500).json({
    error: isMongo
      ? "Database is unavailable. Start MongoDB (docker compose up -d) and retry."
      : "Internal server error",
    code: isMongo ? "DATABASE_FAILURE" : "INTERNAL_ERROR",
  });
}

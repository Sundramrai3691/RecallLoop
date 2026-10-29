import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/errors.js";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    if (err.retryAfterSeconds !== undefined) res.setHeader("Retry-After", String(err.retryAfterSeconds));
    res.status(err.status).json({
      error: err.message,
      code: err.code,
      ...(err.retryable !== undefined ? { retryable: err.retryable } : {}),
      ...(err.retryAfterSeconds !== undefined ? { retryAfterSeconds: err.retryAfterSeconds } : {}),
    });
    return;
  }

  const requestError = err as { status?: number; type?: string };
  if (requestError.type === "entity.too.large" || requestError.status === 413) {
    const isPdfUpload = req.path === "/api/grounding/sources/pdf";
    res.status(413).json(isPdfUpload
      ? { error: "This upload exceeds the 10 MB PDF limit.", code: "PDF_TOO_LARGE" }
      : { error: "The request body is too large.", code: "PAYLOAD_TOO_LARGE" });
    return;
  }
  if (requestError.type === "encoding.unsupported" && req.path === "/api/grounding/sources/pdf") {
    res.status(415).json({
      error: "Send the PDF as an uncompressed application/pdf body.",
      code: "PDF_ENCODING_UNSUPPORTED",
    });
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

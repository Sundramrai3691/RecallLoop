import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/errors.js";
import { getRequestTrace } from "../observability/requestContext.js";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const trace = { requestId: getRequestTrace()?.requestId ?? null, method: req.method };
  if (err instanceof AppError) {
    if (process.env.REQUEST_LOGS !== "0") console.error(JSON.stringify({ event: "http.error", ...trace, status: err.status, code: err.code }));
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
    const isDocumentUpload = req.path === "/api/grounding/sources/pdf"||req.path==="/api/grounding/sources/docx";
    const kind=req.path.endsWith("/docx")?"DOCX":"PDF";
    if (process.env.REQUEST_LOGS !== "0") console.error(JSON.stringify({ event: "http.error", ...trace, status: 413, code: isDocumentUpload ? `${kind}_TOO_LARGE` : "PAYLOAD_TOO_LARGE" }));
    res.status(413).json(isDocumentUpload
      ? { error: `This upload exceeds the 10 MB ${kind} limit.`, code: `${kind}_TOO_LARGE` }
      : { error: "The request body is too large.", code: "PAYLOAD_TOO_LARGE" });
    return;
  }
  if (requestError.type === "encoding.unsupported" && (req.path === "/api/grounding/sources/pdf"||req.path==="/api/grounding/sources/docx")) {
    const isDocx=req.path.endsWith("/docx");
    if (process.env.REQUEST_LOGS !== "0") console.error(JSON.stringify({ event: "http.error", ...trace, status: 415, code: isDocx ? "DOCX_ENCODING_UNSUPPORTED" : "PDF_ENCODING_UNSUPPORTED" }));
    res.status(415).json({
      error: isDocx?"Send the DOCX as an uncompressed Word document body.":"Send the PDF as an uncompressed application/pdf body.",
      code: isDocx?"DOCX_ENCODING_UNSUPPORTED":"PDF_ENCODING_UNSUPPORTED",
    });
    return;
  }

  const databaseError = err as { code?: string };
  if (databaseError.code === "22P02") {
    if (process.env.REQUEST_LOGS !== "0") console.error(JSON.stringify({ event: "http.error", ...trace, status: 400, code: "INVALID_IDENTIFIER" }));
    res.status(400).json({ error: "The requested identifier is invalid.", code: "INVALID_IDENTIFIER" });
    return;
  }
  if (databaseError.code === "23505" || databaseError.code === "23503") {
    const code = databaseError.code === "23505" ? "RESOURCE_CONFLICT" : "INVALID_REFERENCE";
    if (process.env.REQUEST_LOGS !== "0") console.error(JSON.stringify({ event: "http.error", ...trace, status: 409, code }));
    res.status(409).json({ error: databaseError.code === "23505" ? "This change conflicts with an existing record." : "The requested relationship is unavailable.", code });
    return;
  }
  const rawCode = databaseError.code ?? "";
  const isDatabaseFailure = ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EHOSTUNREACH", "ENETUNREACH", "EAI_AGAIN", "EPIPE"].includes(rawCode) || rawCode.startsWith("08") || ["57P01", "57P02", "57P03", "53300"].includes(rawCode);
  if (process.env.REQUEST_LOGS !== "0") console.error(JSON.stringify({ event: "http.error", ...trace, status: isDatabaseFailure ? 503 : 500, code: isDatabaseFailure ? "DATABASE_FAILURE" : "INTERNAL_ERROR" }));

  res.status(isDatabaseFailure ? 503 : 500).json({
    error: isDatabaseFailure
      ? "Database is unavailable. Start PostgreSQL and retry."
      : "Internal server error",
    code: isDatabaseFailure ? "DATABASE_FAILURE" : "INTERNAL_ERROR",
  });
}

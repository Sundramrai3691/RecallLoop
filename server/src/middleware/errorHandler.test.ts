import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { errorHandler } from "./errorHandler.js";

function responseDouble() {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
  };
  return response as unknown as Response & typeof response;
}

describe("errorHandler", () => {
  it("returns an actionable unsupported-encoding error for PDF uploads", () => {
    const response = responseDouble();
    errorHandler(
      { type: "encoding.unsupported", status: 415 },
      { path: "/api/grounding/sources/pdf" } as Request,
      response,
      vi.fn() as NextFunction,
    );

    expect(response.status).toHaveBeenCalledWith(415);
    expect(response.json).toHaveBeenCalledWith({
      error: "Send the PDF as an uncompressed application/pdf body.",
      code: "PDF_ENCODING_UNSUPPORTED",
    });
  });

  it("keeps unsupported encodings on other routes as internal errors", () => {
    const response = responseDouble();
    errorHandler(
      { type: "encoding.unsupported", status: 415 },
      { path: "/api/other" } as Request,
      response,
      vi.fn() as NextFunction,
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  });

  it("returns an actionable unsupported-encoding error for DOCX uploads",()=>{
    const response=responseDouble();
    errorHandler({type:"encoding.unsupported",status:415},{path:"/api/grounding/sources/docx"} as Request,response,vi.fn() as NextFunction);
    expect(response.status).toHaveBeenCalledWith(415);
    expect(response.json).toHaveBeenCalledWith({error:"Send the DOCX as an uncompressed Word document body.",code:"DOCX_ENCODING_UNSUPPORTED"});
  });

  it("returns safe client errors for malformed identifiers and integrity conflicts", () => {
    const malformed = responseDouble();
    errorHandler({ code: "22P02", detail: "sensitive database detail" }, { method: "GET" } as Request, malformed, vi.fn() as NextFunction);
    expect(malformed.status).toHaveBeenCalledWith(400);
    expect(malformed.json).toHaveBeenCalledWith({ error: "The requested identifier is invalid.", code: "INVALID_IDENTIFIER" });
    const conflict = responseDouble();
    errorHandler({ code: "23505", detail: "sensitive database detail" }, { method: "POST" } as Request, conflict, vi.fn() as NextFunction);
    expect(conflict.status).toHaveBeenCalledWith(409);
    expect(JSON.stringify(conflict.json.mock.calls)).not.toContain("sensitive");
  });

  it("maps common database transport failures to a safe retryable status without exposing addresses", () => {
    for (const code of ["ECONNREFUSED", "EHOSTUNREACH", "EAI_AGAIN", "08006", "57P03"]) {
      const response = responseDouble();
      errorHandler({ code, address: "10.0.0.4", port: 5432, detail: "private database endpoint" }, { method: "GET" } as Request, response, vi.fn() as NextFunction);
      expect(response.status).toHaveBeenCalledWith(503);
      expect(response.json).toHaveBeenCalledWith({ error: "Database is unavailable. Start PostgreSQL and retry.", code: "DATABASE_FAILURE" });
      expect(JSON.stringify(response.json.mock.calls)).not.toContain("private");
    }
  });
});

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
});

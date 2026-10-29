import { describe, expect, it } from "vitest";
import { extractPdfPages, MAX_PDF_BYTES, MAX_PDF_PAGES, normalizePdfPageText } from "./pdfExtractor.js";

import { makePdf } from "./pdfExtractorFixtures.js";
function encryptedPdf():Buffer {
  const base=makePdf(["Password-protected PDF text"]);
  const previousXref=Number(base.toString("ascii").match(/startxref\n(\d+)/)?.[1]);
  const objectOffset=base.length;
  const object=Buffer.from(`9 0 obj\n<< /Filter /Standard /V 1 /R 2 /O <${"00".repeat(32)}> /U <${"00".repeat(32)}> /P -4 >>\nendobj\n`,"ascii");
  const nextXref=objectOffset+object.length;
  const suffix=Buffer.from(`${object.toString("ascii")}xref\n9 1\n${String(objectOffset).padStart(10,"0")} 00000 n \ntrailer\n<< /Size 10 /Root 1 0 R /Encrypt 9 0 R /ID [<0123456789abcdef> <0123456789abcdef>] /Prev ${previousXref} >>\nstartxref\n${nextXref}\n%%EOF\n`,"ascii");
  return Buffer.concat([base,suffix]);
}

describe("PDF page extraction",()=>{
  it("keeps extracted text and one-based page provenance across useful and empty pages",async()=>{
    const result=await extractPdfPages(makePdf(["A composite B-tree index supports leading-column predicates.","","Indexes add write cost and require additional storage."]));
    expect(result.pageCount).toBe(3);
    expect(result.pages.map((page)=>page.pageNumber)).toEqual([1,2,3]);
    expect(result.pages[0].text).toContain("leading-column predicates");
    expect(result.pages[1].text).toBe("");
    expect(result.pages[2].text).toContain("write cost");
    expect(result.text).toContain("[Page 1]");
    expect(result.text).toContain("[Page 3]");
    expect(result.text).not.toContain("[Page 2]");
  });

  it("identifies a valid PDF with no usable text as scanned or unextractable",async()=>{
    await expect(extractPdfPages(makePdf([""," "]))).rejects.toMatchObject({code:"PDF_NO_EXTRACTABLE_TEXT",status:422});
  });

  it("rejects malformed and truncated files with actionable, safe errors",async()=>{
    await expect(extractPdfPages(Buffer.from("%PDF-1.7\ntruncated"))).rejects.toMatchObject({code:"PDF_PARSE_FAILED"});
    await expect(extractPdfPages(Buffer.from("%PDF-x not a document"))).rejects.toMatchObject({code:"PDF_PARSE_FAILED"});
  });

  it("rejects oversized uploads before parsing",async()=>{
    const oversized=Buffer.alloc(MAX_PDF_BYTES+1);
    oversized.write("%PDF-");
    await expect(extractPdfPages(oversized)).rejects.toMatchObject({code:"PDF_TOO_LARGE",status:413});
  });

  it("rejects content that merely claims to be a PDF",async()=>{
    await expect(extractPdfPages(Buffer.from("This is not a PDF"))).rejects.toMatchObject({code:"PDF_INVALID_CONTENT"});
  });

  it("rejects documents over the page processing limit",async()=>{
    await expect(extractPdfPages(makePdf(Array.from({length:MAX_PDF_PAGES+1},()=>"")))).rejects.toMatchObject({code:"PDF_TOO_MANY_PAGES",status:413});
  });

  it("reports password-protected PDFs clearly",async()=>{
    await expect(extractPdfPages(encryptedPdf())).rejects.toMatchObject({code:"PDF_ENCRYPTED"});
  });

  it("normalizes extraction whitespace without merging identifiers or SQL tokens",()=>{
    expect(normalizePdfPageText("CREATE   INDEX\n ix_order_tenant ON orders (tenant_id, created_at);\n\n\nWHERE tenant_id = 7"))
      .toBe("CREATE INDEX\nix_order_tenant ON orders (tenant_id, created_at);\n\nWHERE tenant_id = 7");
  });

  it("uses a documented upper page bound",()=>expect(MAX_PDF_PAGES).toBe(100));
});


import { getDocument, PasswordResponses, VerbosityLevel } from "pdfjs-dist/legacy/build/pdf.mjs";
import { AppError } from "../../utils/errors.js";

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 100;
export const MAX_PDF_TEXT_CHARS = 250_000;
const MIN_MEANINGFUL_CHARACTERS = 20;

export interface ExtractedPdfPage { pageNumber: number; text: string; }
export interface ExtractedPdf { pages: ExtractedPdfPage[]; text: string; pageCount: number; }

function pdfError(message: string, code: string, status = 422): AppError { return new AppError(message, status, code); }

export function normalizePdfPageText(input: string): string {
  return input
    .replace(/\u0000/g, "")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractPdfPages(buffer: Buffer): Promise<ExtractedPdf> {
  if (!Buffer.isBuffer(buffer)) throw pdfError("Upload a PDF file.", "PDF_FILE_REQUIRED", 400);
  if (buffer.length > MAX_PDF_BYTES) throw pdfError("This PDF is larger than the 10 MB upload limit.", "PDF_TOO_LARGE", 413);
  if (buffer.length < 8 || buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw pdfError("The uploaded file is not a valid PDF. Choose a PDF document and try again.", "PDF_INVALID_CONTENT");
  }

  let document: Awaited<ReturnType<typeof getDocument>["promise"]> | undefined;
  let loadingTask: ReturnType<typeof getDocument> | undefined;
  try {
    loadingTask = getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, verbosity: VerbosityLevel.ERRORS });
    loadingTask.onPassword = (updatePassword: (password:string)=>void, reason:number) => {
      void updatePassword;
      const message = reason === PasswordResponses.NEED_PASSWORD
        ? "This PDF is password-protected. Remove its password and upload it again."
        : "This PDF could not be unlocked. Remove its password and upload it again.";
      throw pdfError(message, "PDF_ENCRYPTED");
    };
    document = await loadingTask.promise;
    if (!Number.isInteger(document.numPages) || document.numPages < 1) throw pdfError("This PDF has no readable pages.", "PDF_EMPTY");
    if (document.numPages > MAX_PDF_PAGES) throw pdfError("This PDF has more than the 100-page processing limit.", "PDF_TOO_MANY_PAGES", 413);

    const pages: ExtractedPdfPage[] = [];
    let totalCharacters = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      let lineBreak = false;
      const parts: string[] = [];
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const value = item.str.trim();
        if (value) parts.push(`${lineBreak && parts.length ? "\n" : parts.length ? " " : ""}${value}`);
        lineBreak = Boolean(item.hasEOL);
      }
      const text = normalizePdfPageText(parts.join(""));
      totalCharacters += text.length;
      if (totalCharacters > MAX_PDF_TEXT_CHARS) throw pdfError("This PDF contains more than the 250,000-character text limit.", "PDF_TEXT_TOO_LARGE", 413);
      pages.push({ pageNumber, text });
      page.cleanup();
    }
    const useful = pages.filter((page) => page.text.length > 0);
    const meaningfulCharacters = useful.reduce((count, page) => count + (page.text.match(/[\p{L}\p{N}]/gu)?.length ?? 0), 0);
    if (meaningfulCharacters < MIN_MEANINGFUL_CHARACTERS) {
      throw pdfError("No usable text could be extracted. This may be a scanned PDF; OCR is not available yet.", "PDF_NO_EXTRACTABLE_TEXT");
    }
    return { pages, pageCount: document.numPages, text: useful.map((page) => `[Page ${page.pageNumber}]\n${page.text}`).join("\n\n") };
  } catch (error) {
    if (error instanceof AppError) throw error;
    const candidate = error as { name?: string; code?: number; message?: string };
    if (candidate.name === "PasswordException" || candidate.code === PasswordResponses.NEED_PASSWORD || candidate.code === PasswordResponses.INCORRECT_PASSWORD) {
      throw pdfError("This PDF is password-protected. Remove its password and upload it again.", "PDF_ENCRYPTED");
    }
    throw pdfError("This PDF is malformed, truncated, or could not be read. Check the file and try again.", "PDF_PARSE_FAILED");
  } finally {
    await loadingTask?.destroy().catch(() => {});
  }
}

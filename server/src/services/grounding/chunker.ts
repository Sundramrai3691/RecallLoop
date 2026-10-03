import { createHash } from "node:crypto";

export interface TextChunk { id: string; order: number; text: string; metadata: { start: number; end: number }; }

export function stableChunkId(sourceId: string, contentHash: string, order: number, text: string): string {
  return createHash("sha256").update(`${sourceId}\0${contentHash}\0${order}\0${text}`).digest("hex");
}

export function chunkText(sourceId: string, contentHash: string, input: string, chunkSize = 1200, overlap = 160): TextChunk[] {
  if (!Number.isInteger(chunkSize) || chunkSize < 128) throw new Error("chunkSize must be an integer of at least 128 characters");
  if (!Number.isInteger(overlap) || overlap < 0 || overlap >= chunkSize) throw new Error("overlap must be a non-negative integer smaller than chunkSize");
  const text = input.replace(/\r\n?/g, "\n").trim();
  if (!text) return [];
  const chunks: TextChunk[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + chunkSize);
    if (end < text.length) {
      const boundary = text.lastIndexOf("\n", end);
      const whitespace = text.lastIndexOf(" ", end);
      const candidate = Math.max(boundary, whitespace);
      if (candidate > start + Math.floor(chunkSize * 0.65)) end = candidate;
    }
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push({ id: stableChunkId(sourceId, contentHash, chunks.length, chunk), order: chunks.length, text: chunk, metadata: { start, end } });
    if (end >= text.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}

# ADR 013: PDF ingestion and runtime

## Status

Accepted and implemented.

## Context

RecallLoop already stores user-owned source text, deterministic chunks, embeddings, retrieval links, and grounded remediation. PDF support needs to preserve page locations through this same path while handling uploaded binary input safely. The repository previously declared Node 20 as its minimum runtime.

## Decision

- Use Mozilla PDF.js (`pdfjs-dist` 6.4.299), a maintained parser with a Node API, instead of implementing PDF syntax parsing locally or adding multiple overlapping parsers.
- Raise the declared Node runtime minimum to 22.13.0, matching PDF.js's supported Node versions. The configured development runtime is Node 24.18.0.
- Accept raw authenticated `application/pdf` uploads up to 10 MB. Limit extraction to 100 pages and 250,000 characters; do not decompress content-encoded uploads.
- Extract each page independently and retain one-based page numbers in chunk metadata and remediation source records. Persist per-page extraction summaries and the source-byte SHA-256 hash; do not retain the uploaded binary.
- Persist malformed/encrypted extraction failures and use a distinct `scanned_or_no_extractable_text` status when parsed pages yield no usable text. OCR is outside this milestone.
- Reuse grounding source ownership, hash identity, chunking, embedding, retrieval, and remediation storage. Do not create a separate PDF resource or job queue.

## Consequences

Text-based PDFs now reach the existing grounding and remediation flow with page citations. The runtime floor changes from Node 20 to Node 22.13.0; deploys using older Node versions must upgrade before using this release. Scanned image PDFs, DOCX, background jobs, and arbitrary file formats remain unsupported.

## Evidence

- [PDF.js Node example](https://github.com/mozilla/pdf.js/blob/master/examples/node/getinfo.mjs)
- Migration `025_pdf_grounding_sources.sql` and the extraction/service/browser tests cover page association, limits, duplicate uploads, no-text PDFs, malformed inputs, and authenticated persistence.

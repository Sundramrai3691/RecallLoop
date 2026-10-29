# Grounded remediation (Phase 6A)

Grounded remediation is a narrow, evidence-led loop built on RecallLoop's existing concepts, evaluations, assessment questions, learner model, and resource catalog. It does not create another learner-state model or a general chat/tutor feature.

## Data flow

1. A learner can paste text/Markdown, upload a UTF-8 TXT/Markdown file, text-based PDF, or DOCX, or submit a public article URL in Focused Resources. A URL is fetched only by the backend article extractor after protocol, port, DNS, and redirect validation; the chosen public IPv4 address is pinned for the request. Local/private/reserved destinations, non-HTML responses, oversized pages, timeouts, and redirect loops fail without creating source rows. Video transcript retrieval is not configured.
2. Article title and section headings are retained as provenance; extracted text and learner-provided text use the same normalization, SHA-256 content version, deterministic chunking, embedding, and source/chunk persistence path.
3. A submitted recall with a missing or partial knowledge point can trigger focused remediation. The service reads the attempt, rubric results, mistakes, confidence, and recent results for that same point.
4. It queries only the learner's processed sources, ranks chunks against concept + exact knowledge point + any recorded misconception, and rejects results below the relevance threshold.
5. A grounded generator produces a validated structure. Local development uses a deterministic extractive generator; the optional LLM generator receives only the evidence and retrieved excerpts and is instructed to report unsupported details. Generated learner-facing text is rejected if it contains URL tokens; source references remain separately attributed.
6. The learner sees the reason, explanation, excerpt, title, and source reference, then can start a single targeted verification question using the existing Question Engine.
7. Verification is a normal RecallAttempt. The existing evaluator, dimension evidence, scheduler, and learner-model updates run as usual. In the same persistence transaction, the remediation records the targeted point's evidence before and after; `improved` is true only if the weighted evaluated point score increased.

```mermaid
flowchart TD
  A[Recall answer] --> E[Existing evaluation]
  E --> G[Missing or partial knowledge point]
  G --> R[Gap-specific retrieval]
  S[User-provided source] --> I[Chunk and embed]
  I --> R
  R -->|relevant excerpts| M[Grounded remediation]
  R -->|insufficient| F[No generated explanation + resource fallback]
  M --> V[Targeted existing Question Engine attempt]
  V --> E2[Normal evaluation]
  E2 --> L[Learner model and remediation outcome]
```

## Entities and ownership

- `grounding_sources` stores a user-owned document version, original reference, provenance JSON, source type, content hash, and processing state. Identical content from the same user reuses the same row; changed content creates a new version. A source may optionally point at an existing `resources` row.
- `grounding_chunks` stores stable content-derived IDs, order, character offsets, chunk text, embedding model/dimension, and embedding values.
- `grounded_remediations` stores the triggering attempt, exact weak point, evidence-backed reason, lifecycle, generated structure/error, verification attempt, before/after point evidence, and the comparison result.
- `grounded_remediation_chunks` records the exact retrieved chunk IDs and rank/relevance used for a remediation.
- The verification remains in `questions`, `assessment_sessions`, `recall_attempts`, `recall_evaluations`, `recall_knowledge_point_results`, and `recall_dimension_results`. The attempt's optional `remediation_id` links it back to the lifecycle record.

All reads and writes are scoped to the authenticated user. Source references are attribution metadata, not a license to fetch or reproduce remote content.

## Chunking, embeddings, and retrieval

Chunking defaults to 1,200 characters with 160 characters of overlap. Boundaries prefer whitespace; IDs are SHA-256-derived from source version, order, and chunk text. Source ingestion is capped at 250,000 characters per document.

`EmbeddingProvider` separates embedding from retrieval. The default `hash-token-v1` provider is deterministic and has no credential requirement. It is suitable for local use and tests, not a production semantic model. `OpenAiCompatibleEmbeddingProvider` is available only when `EMBEDDING_PROVIDER=openai-compatible` and `EMBEDDING_API_KEY` are explicitly set; it also uses `EMBEDDING_BASE_URL` and `EMBEDDING_MODEL`. Provider/model identity and dimension must match at retrieval time. PDF chunks retain their original one-based `pageNumber` and DOCX chunks retain section and extracted-paragraph ordinals when retrieved.

PDF parsing uses Mozilla PDF.js `6.4.299` from its Node legacy build. Its supported Node runtime floor is `22.13.0`, so the root and server engine declarations now match; the configured development runtime is Node `24.18.0`. The parser is kept in the server only and the original PDF binary is discarded after extraction.

DOCX parsing uses Mammoth `1.13.0` on the server. ZIP central-directory checks reject malformed/truncated, encrypted, multi-volume, ZIP64, path-traversing, duplicate-part, excessive-entry, and excessive-expanded-size packages before Mammoth parses in memory. DOCX is capped at 10 MiB input, 2,000 entries, 20 MiB advertised expanded size, 250,000 extracted characters, and a 1000:1 per-part expansion ratio. Extraction retains heading hierarchy, list items, table rows/cells, code-style blocks, Unicode, and stable extracted text-block ordinals. It does not claim Word page positions. Mammoth warnings or unsupported Word features can affect conversion; uploaded content remains learner-supplied source material and is not thereby verified as authoritative.

The current PostgreSQL instance does not offer the `vector` extension (`pg_available_extensions` contains no `vector`). To keep migrations runnable here, embeddings are stored in PostgreSQL `real[]`; the service uses cosine similarity plus deterministic significant-token overlap and a fixed relevance threshold. Retrieval is bounded to the most recent 5,000 matching chunks per learner. If pgvector is installed in a later deployment, the repository can move the same provider output to a vector column and database index.

## Grounding and fallback rules

- No relevant chunk means no explanation is generated. The learner sees that material was not found and gets up to three existing resource recommendations when any match.
- A source that fails processing is kept with `processing_status=failed` and a bounded error. Posting the same text again retries it idempotently.
- PDF source hashes are computed from uploaded bytes. Successful identical uploads reuse the processed source and its chunks without embedding again. Malformed, encrypted, or otherwise unreadable PDFs retain a failed source row; PDFs with no usable extracted text use `scanned_or_no_extractable_text` and never become eligible for remediation retrieval.
- DOCX source hashes are computed from uploaded bytes. Successful identical uploads reuse the processed source and chunks without embedding again. Invalid packages, unsupported encryption/ZIP variants, and empty/no-useful-text documents remain failed and are not eligible for retrieval. Each indexed chunk carries a section label when present and the range of extracted paragraph/list/table/code block ordinals it intersects.
- Embedding provider errors persist a failed lifecycle/source state and do not mutate learner evidence.
- Generator failure retains retrieved chunk links and source attribution. Retrying the remediation request reuses the existing remediation row rather than duplicating it.
- The deterministic local generator extracts relevant source sentences. It may report that no specific misconception was recorded rather than invent one.
- The optional LLM generator uses the existing `LlmProvider`, validates a Zod-checked JSON structure, receives no authority to update learner state, and has no numeric mastery field. Set `REMEDIATION_PROVIDER=llm` explicitly along with a configured non-mock `LLM_PROVIDER` and `LLM_API_KEY` to enable it. Otherwise the deterministic generator remains active.

## API and UI

- `POST /api/grounding/sources` ingests `{ title?, text?, sourceType, reference?, url?, provenance? }`; `sourceType: "web_article"` fetches a validated HTML article, while `text` and `markdown` use supplied text. `sourceType: "web_article"` is stored under the same owner/hash idempotency rule.
- `POST /api/grounding/sources/pdf` accepts an authenticated `application/pdf` body with title/reference metadata headers. The 10 MB, 100-page and 250,000-character bounds are enforced. PDF.js extracts text page by page; page numbers remain attached to indexed chunks and citations. Empty/scanned-like documents report a distinct no-extractable-text status. Password-protected files are rejected; OCR is not performed.
- `POST /api/grounding/sources/docx` accepts an authenticated raw DOCX body with title/reference metadata headers. The 10 MiB upload, 2,000 archive-entry, 20 MiB advertised expanded-part, 250,000 extracted-character, and per-part compression-ratio bounds are enforced. Mammoth's internal HTML conversion is reduced to structured plain text: headings, lists, tables, and code-style blocks remain ordered. Chunk metadata and remediation citations include section and extracted text-block ranges, never Word page numbers. Invalid, encrypted, unsupported ZIP variants, and empty documents are retained as failed sources rather than made ready.
- `GET /api/grounding/sources` lists the current user's source metadata.
- `POST /api/remediations/from-attempt/:attemptId` creates or returns the remediation for a submitted attempt.
- `GET /api/remediations/:id` reads the lifecycle and cited excerpts.
- `POST /api/remediations/:id/verify` creates or returns the targeted existing recall attempt.
- Verification answers use the existing `POST /api/recalls/:id/submit` endpoint.

Focused Resources includes pasted text, Markdown, TXT/Markdown upload, PDF and DOCX upload, public article URL, and explicit unsupported-state messaging for video transcripts. It previews extracted material, reports PDF page counts and DOCX text-block/section counts, and keeps malformed/empty extraction in a failed state. Scanned-like PDFs explain that OCR is unavailable. The remediation view displays source title/reference, PDF page citations, or DOCX section and extracted-paragraph ordinals beside retrieved passages. Recall Result offers remediation only when its persisted recommendation is remediation, and the remediation view retains targeted verification.

## Tests and limits

Unit tests cover stable chunking, deterministic embeddings, ranking/irrelevant rejection, article security, PDF and DOCX structural/provenance/limit/error behavior, whitespace normalization, structured validation, extractive grounding, fallback, and targeted question variants. PostgreSQL integration tests use the configured local database and cover PDF/DOCX metadata, content-hash duplicate retries, failed and scanned-source persistence, ownership, existing article/text paths, remediation and verification. The shared Playwright browser journey covers registration, text/Markdown/PDF/DOCX upload, page and section/paragraph citations, malformed document outcomes, invalid local-URL rejection, scanned-PDF messaging, DBMS assessment, persisted diagnosis, grounded remediation, distinct revision verification, readiness, reload persistence, keyboard use and responsive layouts. Edge has passed locally. Firefox now selects Playwright's version-matched Firefox build; this Windows host has no cached Firefox build, so local Firefox execution remains unverified. The dedicated CI workflow provisions and runs that browser path, but has not yet been executed by a remote CI runner.

Known limitations: URL fetching currently supports public HTML articles only; dynamic/authenticated pages and video transcripts are unsupported. TXT/Markdown files are read in the browser and are capped at 250,000 characters. PDF extraction supports text-based documents only; scanned image pages require OCR, which is not implemented. DOCX pagination is renderer-dependent and intentionally not represented; complex Word constructs outside Mammoth's supported conversions may be omitted. The deterministic mock embedder is not a substitute for production semantic embeddings. The current PostgreSQL deployment lacks pgvector, so ranking happens in application code over bounded per-user chunk rows. Zod was upgraded to 4.6.6 and Vitest to 5.0.5; the npm audit after remediation reported zero vulnerabilities. LLM output is constrained and validated but still requires human review for product quality. Evidence scores and the improved flag are transparent product heuristics, not validated learning-science measures.

### OCR feasibility result (2026-10-30)

The existing PDF.js digital-text path remains unchanged. Its 10 MiB input, 100-page, and 250,000-character caps do not establish safe OCR limits.

| Candidate | Local evidence | Quality / speed / memory | Deployment and operations | Decision |
|---|---|---|---|---|
| Tesseract via `pytesseract` | Python 3.12 has `pytesseract` 0.3.10, but its engine invocation failed with `TesseractNotFoundError` because no `tesseract.exe` is installed/on PATH. No language data was available to inspect. | Not measured: there was no executable to process deterministic scan fixtures. | Would require installing and versioning the native engine plus language data, invoking it with file/page/time limits, and isolating CPU-heavy work from the request handler. | Defer; no local OCR run is possible. |
| EasyOCR | Python has EasyOCR 1.7.0, PyTorch 2.13.0, pypdfium2 5.13.0 and Pillow 10.1.0. Import took 11.741 s in a later run. `Reader(['en'], gpu=False, download_enabled=False)` then failed in 0.013 s because `craft_mlt_25k.pth` was absent. An earlier default model-cache attempt also hit Windows `Access is denied` at `%USERPROFILE%\\.EasyOCR`. | No recognition output; accuracy, per-page/full-document latency, and peak memory are unmeasured. Import/setup time is not OCR processing time. | CPU inference is supported by the project, but model weights must be provisioned; the project supports a configurable model directory. Windows and Linux package/runtime matrices and model licensing still need a deployment-specific review. | Defer; package presence alone is not an executable OCR installation. |
| Tesseract.js / hosted OCR | Tesseract.js is not in the Node dependency tree. No OCR service, credential path, or privacy approval is configured. | Not measured. | Tesseract.js requires PDF pages to be rendered to images and recommends bounding workers because of memory use. Hosted OCR would add source-data transfer, credential, cost, and retention questions. | Do not add during this milestone. |

No scanned-PDF OCR fixture benchmark was claimed: no recognizer with its required model files could run, so fixture scores would have been fabricated. Clean/degraded/mixed-page/blank accuracy, page latency, peak memory, maximum safe document size, and confidence calibration remain **unknown**, not estimated. PDF.js already retains one-based page records; preserving those references through per-page OCR is feasible in principle but has not been exercised. Any future recognition process should run outside the HTTP request path with bounded page raster dimensions, time, memory and concurrency; this is an architectural requirement, not a measured capacity result.

**Decision: defer OCR.** Keep scanned/no-text PDFs unavailable to grounded remediation. Revisit only in an environment with a pinned OCR engine and weights plus deterministic synthetic fixtures for digital text, clean one-page and multipage scans, degraded scans, mixed digital/scanned pages, and blank/unreadable pages. EasyOCR's maintainers document downloadable model weights and CPU mode; Tesseract.js documents worker memory and the separate PDF renderer requirement. References: [EasyOCR README](https://github.com/JaidedAI/EasyOCR/blob/master/README.md), [EasyOCR API](https://jaided.ai/easyocr/documentation/), [Tesseract.js performance](https://github.com/naptha/tesseract.js/blob/master/docs/performance.md), [Tesseract.js FAQ](https://github.com/naptha/tesseract.js/blob/master/docs/faq.md), [Tesseract language data installation](https://tesseract-ocr.github.io/tessdoc/Installation.html).

## Manual learner scenarios

With the API running against a migrated PostgreSQL database, create a learner account and add a small source through Focused Resources (for example, notes that explicitly explain the TCP congestion window and receiver window). Then try:

1. **Strong recall:** answer the relevant knowledge point correctly. Remediation should not be recommended for that point.
2. **Weak recall:** omit a central distinction. The result should offer a focused remediation with an evidence-based reason and an attributed excerpt.
3. **Repeated misconception:** submit another weak answer that repeats the same misconception. The reason should reflect the persisted history, and the verification should use new wording for the same point.
4. **No relevant material:** ingest an unrelated source and request remediation for a gap. The UI should explain that useful material was not found and show existing resource recommendations when available.
5. **Improved verification:** answer the targeted question more completely. The normal evaluation should update learner evidence, and the remediation record should show the before/after outcome.

These are product checks, not proof of learning-science validity. Automated PostgreSQL coverage and manual browser exercise status are tracked separately in [Project Status](PROJECT_STATUS.md).

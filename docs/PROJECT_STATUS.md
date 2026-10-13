# Project status

Status is based on checked-in source and commands run as of 2026-10-14. This is not a claim about any deployed environment or production usage.

## Status definitions

- **IMPLEMENTED**: behavior and wiring exist in source.
- **TESTED**: a relevant test exists and the stated command passed in this work session.
- **PARTIALLY TESTED**: some tests exist, but coverage or execution is incomplete.
- **BLOCKED LOCALLY**: verification needs a local service/tool that was unavailable.
- **PLANNED**: no implementation evidence found; use only when a plan document supports it.
- **UNKNOWN**: repository evidence is insufficient.

Presence of a test file alone does not mean it passed in this session.

## Current evidence

| Area | Status | Evidence |
|---|---|---|
| React/Vite client and Express API workspace | IMPLEMENTED | Root and workspace package scripts; `client/src`, `server/src`. |
| PostgreSQL runtime and ordered migrations | IMPLEMENTED | `server/src/db/*`, additive migrations `001`–`015`. |
| Authenticated goals, skills, plans, and dashboard | IMPLEMENTED | Goal/dashboard services and authenticated routes. |
| Canonical knowledge, baseline and learner summaries | IMPLEMENTED | Knowledge/baseline/learner services and migration `001`. |
| Canonical knowledge-point seed integrity | TESTED | Verified the local DB had 48 identical rows for each of 9 seeded canonical points (432 rows / 9 unique concept-statement identities); migration `015` consolidated them to 9 rows, remapped 21 baseline-question point references, retained an audit of all 9 duplicate groups, and added a uniqueness index. PostgreSQL regressions verify HTTP caching plus a separate topic, migration rerun idempotency, role-roadmap count, evidence-FK preservation, and manual-review retention for metadata conflicts. |
| Canonical roadmap-to-study identity | TESTED | Migration `014` adds optional session topic/concept links, exact-name personal-concept links and unique exact-match point evidence links; authenticated roadmap data exposes role/skill/topic/concept/point nodes, direct prerequisites, resources and persisted evidence statuses. Unit and PostgreSQL regressions passed in this session. Historical sessions remain unmapped; no browser trace was performed. |
| Study sessions, recall, evaluation, scheduling | IMPLEMENTED | Study/recall/evaluator/scheduler services and core migration. |
| Recoverable real-provider 429 handling | TESTED | OpenAI-compatible LLM errors distinguish transient rate limits from quota exhaustion using safe structured fields; short transient retry is bounded to one, long `Retry-After` is returned to the client, and auth/quota/permanent errors are not retried. Recall and study forms preserve inputs and report pending/not-created state. PostgreSQL injected-429 tests cover both provider-dependent paths and confirm no partial evaluation evidence or session insert. |
| Assessment sessions, hints, question selection | IMPLEMENTED | Question/assessment services, migration `004`–`008`. |
| Structured multipart answers and per-point learner state | TESTED | Question part storage, part validation/evaluation, transactional point state in migration `011`; unit suite and PostgreSQL roundtrip/retry integration checks passed in the latest verification session. |
| Resource recommendations and learning packs | IMPLEMENTED | Resource services and routes. |
| Grounding ingestion, retrieval, remediation and verification | IMPLEMENTED | Grounding services/routes and migration `010`. |
| Unit-level tests | TESTED | 2026-10-14: `npm test` passed, 19 files / 88 passed; four opt-in live-provider checks skipped. |
| Client and server production builds | TESTED | 2026-10-14: `npm run build` passed for server TypeScript and the client Vite production build. |
| PostgreSQL integration tests | TESTED | 2026-10-14 deterministic `npm run test:integration -w server` passed 10/10 against the confirmed local `recallloop` database; provider selectors were set to mock. Migration/seed idempotency, canonical-point references, baseline single-submit/concurrent completion, provider failure recovery, and remediation paths were covered. |
| Current developer API startup | UNKNOWN | `npm run dev` was not run in this session. Docker reported the PostgreSQL 16 container healthy, and the integration suite connected successfully. |
| Manual browser exercise | UNKNOWN | No browser exercise was performed in this documentation session. |
| Production deployment, uptime, data population | UNKNOWN | No deployment/runtime telemetry is available in the repository. |
| Baseline point identity/count and no-evidence score semantics | TESTED | Baseline generation selects distinct concepts, counts unique submitted points, and stores no evidence as `NULL`; migration `012` is additive. No evidence displays “Not assessed”; measured 0 stays 0; fewer than three unique assessed points receive “Early signal,” not a mastery band. Verified by unit and PostgreSQL regressions. |
| Baseline submission single-write and concurrency | TESTED | Submissions lock their assessment, conditionally save only pending questions, and atomically update completion and learner-state aggregates. The 2026-10-14 PostgreSQL integration run passed the regression proving duplicate requests preserve the first answer and concurrent final answers complete the assessment. |
| Study extraction retry idempotency | IMPLEMENTED | Extraction normalizes duplicate labels/points within one result and repository persistence reuses an existing concept for the same owner/session/name under an advisory transaction lock. Verified by PostgreSQL integration regression; existing historic duplicates are preserved. |
| Question-generation quality | PARTIALLY TESTED | Built-in questions now bind rapid recall to the point named, and uncurated MCQs fall back to recall. Templates and curated MCQs have structural/unit coverage; provider-generated questions do not exist and pedagogical quality is not validated. |
| Resource title fallback | IMPLEMENTED | A raw YouTube/Vimeo URL title is replaced with a source-based safe label while its URL and recommendation reason remain intact. Unit coverage added. |
| Active evaluator provider | PARTIALLY TESTED | Local `.env` now selects `openai-compatible` with Gemini 3.8 Flash and a configured key. Isolated extraction and evaluation smoke checks passed; earlier requests also timed out or returned HTTP 503, so stable provider availability is not established. See the latest session entry. |
| Study topic/source identity | TESTED | New study input rejects URL-shaped topics and URL-only material; optional HTTP(S) source URL is stored and serialized separately from topic and raw material. Unit + PostgreSQL roundtrip regression. |
| Extraction content integrity | PARTIALLY TESTED | New study extraction strips URL tokens, requires supplied text, rejects URL tokens in extracted names/descriptions/knowledge-point statements, validates structured output, and executes before session persistence. Unit tests and PostgreSQL repeated-input coverage passed. Read-only scan found 4 historical URL-only sessions and 4 derived URL-bearing concepts; all 4 have no separate `source_url`, and 17 submitted attempts exist across them. Those records were preserved because learner evidence is attached; targeted historical remediation and browser checks remain outstanding. |
| Generated remediation URL integrity | TESTED | Structured remediation output rejects URL tokens before it is shown as learner-facing content; unit regression passed 2026-10-14. Historical remediation records and manual browser behavior remain unverified. |
| Historical URL contamination scan | TESTED | Read-only scan against local `recallloop` found 20 URL-bearing question records associated with the 4 contaminated concepts; no contaminated remediation or raw resource titles were found. No historical rows were modified. |
| Learner overview with no observations | TESTED | No assessed concepts yields `averageMastery: null` from the service and the UI says “Not assessed” rather than `0%`. PostgreSQL summary regression; UI production build passed. |
| Resource explanation integrity | TESTED | Recommendation no longer presents `coverage_strength` as a percentage or displays uncalibrated trust/freshness fields; stored duration remains labeled as an estimate. Unit and PostgreSQL resource checks passed. |
| Safe provider configuration diagnostic | TESTED | `npm run config:check -w server` reports Gemini-compatible extraction/evaluation and embeddings plus LLM-grounded remediation without credentials. |
| Provider selection and error handling | TESTED | LLM/embedding accept `mock` or `openai-compatible`; remediation accepts `mock` or `llm`. Unit tests cover strict selection, authentication/quota/server errors, malformed output, request shape, URL handling, and embedding dimensions. Live results are in the latest session entry. |
| Current local provider configuration | TESTED | Non-secret `.env` selectors/model/base URL were aligned with the verified Gemini setup; existing key values were preserved. The safe config diagnostic reports the three configured Gemini-backed paths. |
| Live Gemini capabilities | PARTIALLY TESTED | Isolated extraction/evaluation passed; the embedding endpoint returned 3072 finite dimensions; grounded remediation passed schema validation once; built-in question generation passed its deterministic check. Other requests timed out or returned HTTP 503. Live outcomes do not establish stable availability or pedagogical quality. |
| Generic question quality | PARTIALLY TESTED | Source confirms built-in deterministic blueprints and curated MCQs; LLM is not used to generate questions. Semantic quality remains a Phase C task. |
| Manual browser workflow | UNKNOWN | This session did not exercise the browser UI. |

## Local verification commands

```powershell
docker compose up -d postgres
npm run db:migrate -w server
npm run db:seed -w server
npm run dev
```

The compose file defines PostgreSQL 16 on port 5432. If Docker is unavailable, provide a PostgreSQL instance matching `DATABASE_URL` in `.env`. Apply migrations before the first API run; startup itself only runs `SELECT 1`.

## 2026-10-11 — Core learning pipeline repair, Phase 1

- Inspected the study, evaluator, learner summary, baseline report, question, resource and provider paths. Confirmed URL/topic conflation and topic-only synthetic extraction; confirmed no-evidence learner summary displayed as `0%`; confirmed questions are built-in, not LLM-generated; confirmed resource explanation converted a stored strength value to a percent and exposed uncalibrated trust/freshness claims. Exact user-reported repeated display could not be reproduced from a supplied record; code deduplicates exact point text per extraction/session but point identities remain labels.
- Added migration `013_study_session_source_url.sql` and its explicit sequence order. New study sessions distinguish title, optional HTTP(S) link and supplied text. URL-only topics/material are rejected; source URLs are stripped from extraction text; structured extraction is prepared before session persistence; session source URL roundtrips through repository and API serialization.
- Empty mock extraction now yields no concept; the LLM prompt forbids topic-only concept invention; extracted URL names are rejected. Dedupe behavior preserves exact-normalized concepts/points without fuzzy-merging similar concepts.
- Learner overview now distinguishes null/no evidence from measured zero. Resource recommendations no longer state coverage percentages, trust tiers or freshness years; duration is shown as an estimate. Safe provider diagnostic reports actual subsystem behavior without credentials. `.env.example` is restored to mock defaults and credential values were removed.
- Roadmap and decision record added; flow, data model, README, status and session log updated. Phase B–F are planned, not claimed as delivered. Canonical UUID links for personal concepts/points, question-quality validation, real-provider checks and browser exercise remain incomplete.
- Verification: `npm run build` passed; `npm test` passed (14 files / 53 tests); `npm run test:integration -w server` passed against PostgreSQL (6/6 tests, 0 skipped); provider diagnostic ran and reported mock/deterministic providers; `git diff --check` passed.

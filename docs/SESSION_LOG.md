# Session log

Append new entries at the end. Do not edit or reorder previous entries. Repository history does not show a prior session log, so the baseline below is reconstructed from the checked-in repository; earlier work dates and verification outcomes are unknown.

## Reconstructed baseline — 2026-10-09

- Repository head observed: `f525d3c` (`feat: update registration flow to navigate to onboarding page after account creation`). This identifies the checked-out commit at reconstruction time, not the origin of every working-tree change.
- Existing docs cover architecture, adaptive learning, knowledge/learning models, question engine, grounded remediation, frontend design, PostgreSQL migration/cutover, audits and implementation reports.
- Current source contains React/Vite client, Express/TypeScript server, PostgreSQL migrations `001`–`010`, unit tests, and an integration test requiring PostgreSQL.
- User-reported `npm run dev` output showed Vite ready while the API failed its database probe with `ECONNREFUSED 127.0.0.1:5432`; API proxy errors followed. This points to unavailable PostgreSQL at that address, not a Vite startup failure.
- Historical discussions, decision dates, previously run test outcomes, production deployments, and current database contents: UNKNOWN.

## 2026-10-09 — Documentation system

- Added repository agent guidance, a docs index, source-derived request flows and PostgreSQL data model, retrospective decision records, evidence-based project status, and this append-only session log.
- Existing domain and audit documents were retained.
- Verification: `npm run build` passed; `npm test` passed (8 files, 32 tests); relative Markdown links resolved; `git diff --check` passed.
- PostgreSQL integration tests were not run because local PostgreSQL was unavailable at the configured `127.0.0.1:5432` endpoint, matching the startup refusal reported by the user.

## 2026-10-10 — Phase 6B structured questions

- Reused the existing question, recall submission, evaluator, point-result and transaction pipeline. Added optional structured parts for multi-point short-explanation questions, part-keyed answers, strict part/result association, explicit missing-part evidence, and independent learner state keyed by user/concept/point.
- Added migration `011_structured_question_parts.sql`; existing question/answer columns and the legacy one-string API continue to support old records. MCQ grading remains deterministic.
- Added unit tests for question parts, mapping/validation, independent scores, missing answers, malformed evaluator point mappings, legacy questions and MCQ behavior. Added a PostgreSQL roundtrip/retry integration test.
- `npm test`: passed, 9 files and 39 tests. `git diff --check`: passed.
- `npm run test:integration -w server`: blocked; migration setup could not connect to `127.0.0.1:5432`, so all 4 integration cases were skipped. The DB persistence assertions have not been run locally.
- `npm run build`: passed for server and client production builds.

## 2026-10-11 — Core learning integrity and content quality

- Root causes confirmed in code: baseline generation joined concepts to all knowledge points and made one question per joined point, while submission evaluated every point on that concept. This produced redundant questions and inflated displayed point counts. Baseline score aggregation returned zero for empty evidence, and the baseline table prohibited `NULL`. Free recall prompts named a target point while evaluating every point; generic MCQs used unsupported filler distractors. Resource endpoints returned stored titles verbatim, including when a title duplicated its URL.
- Baseline generation now creates one question per concept tied to a stable canonical point ID, and each new answer evaluates only that assigned point. Historical rows without a point ID retain their old all-points evaluation behavior. Completed mastery is calculated from unique submitted outcomes. No evidence stays `NULL`; migration `012_observed_mastery_is_nullable.sql` is additive and does not delete data. The result page deduplicates by canonical ID (with a label fallback for legacy rows) and derives displayed percentage and band from the same evidence.
- Study extraction normalizes repeated labels/points within a response and persistence reuses matching concepts for the same owner/session inside an advisory-locked transaction. Historical user data is preserved. A read-only aggregate query found zero duplicate personal concept rows, zero repeated point labels within concepts, and zero resources whose title equals their URL in the configured local database.
- Rapid recall evaluates the point named by its prompt. MCQs without a curated key and misconception distractors fall back to free recall; deterministic grading remains for curated MCQs. Question generation is currently built in, not LLM-driven. Local provider configuration is `mock`, with no API key configured; real-provider answer quality is unverified.
- Raw YouTube/Vimeo URLs used as resource titles now receive a safe source label in recommendation and canonical-resource responses; stored URL, clickable destination, provider attribution, and reason are retained.
- `npm run build`: passed. `npm test`: passed (10 files / 44 tests). `npm run test:integration -w server`: passed against live PostgreSQL (5/5, no skips). `git diff --check`: passed.
- Remaining limits: personal knowledge points remain labels without canonical UUID links; older duplicate records are preserved and only hidden from repeated baseline presentation; templates and mock overlap evaluation are not evidence of pedagogical validity. Real-provider and manual browser checks remain unperformed.
- Canonical UUID linkage is not present in the current personal knowledge-point model; parts validate against the question's existing point labels rather than inventing canonical IDs.

### Verification follow-up — 2026-10-09

- Re-ran `npm run build`: passed (server TypeScript and client Vite production build).
- Re-ran `npm test`: passed (8 files, 32 tests).
- Attempted `npm run test:integration -w server`: setup failed at migration with `ECONNREFUSED 127.0.0.1:5432`; all 3 integration tests were skipped. No PostgreSQL integration result is claimed for this session.
- Updated current architecture/status references and labeled earlier implementation reports as historical snapshots.
- Added five manual learner scenarios to the grounded-remediation guide. Browser exercise remains unperformed.
- Markdown links resolved. `git diff --check` and untracked-doc whitespace scan passed; Git only reported its standard LF-to-CRLF working-copy warnings on modified files.

## 2026-10-10 — Structured-question PostgreSQL integration regression

- Root cause: the integration test called `createAssessment`, whose service result uses the repository's raw attempt shape (`question.parts`). It incorrectly asserted `questionData.parts`, which is introduced only by `serializeAttempt` in the HTTP controller. Generation, `question_parts` persistence, repository loading, and HTTP serialization were functioning.
- Corrected the test to identify the short-explanation question by type, inspect `question.parts`, compare its knowledge-point associations with the fixture, read the persisted `question_parts` value, and verify `serializeAttempt` exposes the API's `questionData.parts` contract.
- The corrected roundtrip also exposed an incorrect expectation for initial point mastery: a first correct result initializes mastery at `1.0` (the raw evidence score); `.6` is only the update coefficient for later observations. Updated the assertion to match the implemented learner-state rule and retained the assertion that the missing point remains at `0`.
- Strengthened read-back assertions for both learner point states, persisted part-attributed results, serialized answers, and duplicate-submission idempotency. No production API or storage behavior changed in this bug fix.
- `npm run test:integration -w server`: passed, 4/4 cases against PostgreSQL. `npm test`: passed, 9 files / 39 tests. `git diff --check`: passed.
- `npm run build`: passed for server and client production builds.

## 2026-10-11 — Core learning pipeline repair, Phase 1

- Confirmed URL/topic conflation: session title flowed into extraction, empty study text was allowed, and the mock plus LLM prompt could create a topic-only concept. Added topic URL validation, required source text, optional separate HTTP(S) source URL, extraction URL-token stripping, extracted URL-name rejection, and prepare-before-session persistence. Added migration `013` and sequence ordering; its SQL is idempotent because the integration migration runner reapplies the full sequence.
- Confirmed the learner overview displayed `0%` when its service returned `averageMastery: null` and `assessedConcepts: 0`; it now displays “Not assessed.” Baseline API counts unique stable point IDs, returns null for no evidence, and labels fewer than three points “Early signal” even if one answer yields 100% point coverage. The report distinguishes point coverage from concept mastery.
- Exact duplicate knowledge-point normalization is present within extraction and same-session persistence, but the reported repeated-description instance was not supplied for reproduction. No existing user data was cleaned. Personal knowledge-point labels still lack canonical UUIDs and semantic dedupe remains future work.
- Confirmed question generation is built-in deterministic blueprints plus curated MCQs; the LLM is used for extraction and free-form evaluation, not question generation. This pass documents the quality gap instead of treating mock questions as provider evidence.
- Confirmed resource reasons converted `coverage_strength` to a percentage and exposed uncalibrated trust/freshness metadata. Removed these claims and those score inputs; kept catalog concept relations, source URLs/titles and clearly labeled time estimates. Resource URLs remain preserved/clickable.
- Added a credential-free provider diagnostic. `npm run config:check -w server` passed and reported mock extraction/evaluation, built-in questions, deterministic local embeddings and deterministic extractive remediation. Live-provider behavior is unverified. Credential-shaped values found in the working `.env.example` were removed; the template now contains empty keys and mock defaults.
- Added core-learning roadmap, ADR 007, and updated README, FLOW, DATA_MODEL, PROJECT_STATUS and this log. Phases B–F remain planned; canonical personal-point mapping, real-provider quality and browser validation are outstanding.
- Verification: `npm run build` passed; `npm test` passed (14 files, 53 tests); `npm run test:integration -w server` passed against PostgreSQL (6/6, 0 skipped); `npm run config:check -w server` passed; `git diff --check` passed (Git emitted only expected working-copy line-ending notices). The initial repeat integration run found migration 013 was omitted from explicit ordering and not rerunnable; migration order and idempotency were corrected. A baseline assertion was then aligned with the intended “Early signal” band for fewer than three points.

## 2026-10-11 — GitHub push protection remediation

- Rebuilt the unpushed local feature commit from `origin/main` after GitHub rejected its predecessor because `.env.example` contained credential values. Restored the prior empty-key, mock-provider template and kept the feature implementation; the later local commit only deleted that template and was not replayed.
- The sanitized commit is local and has not been pushed. Rotate/revoke any exposed provider credentials that were real; removing them from the branch does not invalidate them.
## 2026-10-11 — Provider configuration and Gemini smoke checks

- Confirmed supported selectors from provider factories: `LLM_PROVIDER=mock|openai-compatible`, `EMBEDDING_PROVIDER=mock|openai-compatible`, and `REMEDIATION_PROVIDER=mock|llm`. The LLM path handles study concept extraction and free-form evaluation; question generation remains built-in. Embeddings handle grounding-source ingestion and retrieval. `llm` remediation uses the configured LLM with retrieved source context.
- Removed silent provider substitution: unsupported labels and missing selected-provider keys now fail explicitly. HTTP authentication, access, rate/quota, request, provider, and timeout failures receive safe codes; response bodies and keys are not logged. Malformed LLM output remains a surfaced validation error after one bounded retry.
- Updated `.env.example` with mock defaults and a credential-free Gemini example. Updated local `.env` provider selectors, Gemini embedding model, and endpoint to the supported configuration; existing key values were preserved. `npm run config:check -w server` reported Gemini-compatible LLM/embeddings and LLM-grounded remediation without displaying credentials.
- Confirmed from Google's Gemini docs that `gemini-3.8-flash` is available through the OpenAI-compatible chat endpoint and that Gemini embeddings are exposed through the compatible embeddings endpoint. The live call for `gemini-embedding-001` returned 3072 finite values; Gemini omits the optional row index, so the adapter now accepts ordered unindexed rows as well as indexed OpenAI-compatible responses. PostgreSQL `real[]` stores variable-length values with each vector's model and dimension; retrieval filters by both.
- Gemini 3 chat requests now omit `temperature` and preserve the model default. This follows the Gemini 3 parameter guidance and is covered by a unit test.
- Live checks: concept extraction and free-form evaluation each passed in isolated runs; question generation passed through the deterministic built-in path; embedding returned 3072 dimensions; grounded remediation passed schema validation in one run. Other combined/isolated requests intermittently returned HTTP 503 or timed out; stable provider availability is not claimed. No response text or credentials were printed.
- Verification commands: final `npm run build` passed; final `npm test` passed (17 files, 74 passed, 4 opt-in live checks skipped by default); `npm run config:check -w server` passed and showed Gemini-compatible LLM, embedding, and remediation paths; `git diff --check` passed with only Git's LF/CRLF working-copy notices. Isolated live extraction/evaluation passed; embedding returned 3072 finite dimensions; built-in question generation passed; grounded remediation passed once. Other live requests intermittently timed out or returned HTTP 503, so live stability remains unverified.
- Updated Architecture, FLOW, PROJECT_STATUS, DECISIONS and ADR 008 to document current provider behavior, endpoint shapes, dimension persistence/retrieval, and observed smoke results.

# RecallLoop project reality audit

**Audit date:** 2026-11-02

**Repository:** `C:\Users\HP\RecallAI`
**Scope:** source, database/migration design, learner journeys, AI/retrieval, tests, operations, and existing performance evidence. This is an engineering audit, not a penetration test, educational validation, or production certification.

## Executive assessment

RecallLoop is a coherent single application: a React/Vite client calls one Express API; PostgreSQL is the durable store; domain services own assessment, recall, planning, retrieval, remediation and readiness rules. The repository has unusually strong transactional and browser coverage for an early product, and same-day reports describe completed Edge learner journeys. The current unit suite and production build were rerun successfully during this audit.

The core application is **implemented and locally validated, but not production-ready**. The highest-impact product weakness is retrieval candidate selection: SQL orders chunks by source recency and chunk order, then the repository takes only the first 40 before semantic ranking. Older sources and later chunks of long documents therefore may never compete for remediation context. AI grading, extraction and remediation are wired to live providers, but provider connectivity failed in the latest recorded check and there are no independent human benchmark labels. Neither the deterministic test path nor a valid JSON response establishes semantic grading quality.

Security and operations documentation correctly identifies important launch blockers: the configured local database role is superuser, rate limits are per process, no deployed CSP/HSTS or restore drill has been demonstrated, and the current environment is development configuration. Performance results demonstrate local improvements to dashboard and study completion, but readiness timing varies substantially across repeat runs; the single before sample is insufficient to establish a stable regression or improvement.

### Current classifications

| Capability | Audit status | Evidence boundary |
|---|---|---|
| Registration, login, token restore, protected routes, logout | `VERIFIED_WORKING` for recorded local Edge paths | Same-day status reports Edge auth lifecycle; this audit did not rerun browser or DB tests. Logout clears the browser token but does not revoke a copied JWT server-side. |
| Learn from supported material (text, Markdown, article, PDF, DOCX) | `VERIFIED_WORKING` for recorded local Edge paths | Existing same-day report records PDF source → study → recall → remediation → distinct verification. Parser/source support is not a claim that arbitrary material is authoritative. OCR/video transcripts are not implemented. |
| Canonical knowledge checks, assessment/report, remediation/verification | `VERIFIED_WORKING` for tested eligible concepts | Exact revision eligibility and submitted evidence are implemented; no independent review or learning-effectiveness claim. Backend Engineering has no current question revisions. |
| Recall grading, evidence and scheduling | `VERIFIED_WORKING` as an engineering flow; semantic quality `BLOCKED_EXTERNAL` | Unit suite passed now; earlier same-day Edge and integration results are documented. Live provider is unavailable in the latest recorded smoke/benchmark. |
| Readiness and cross-goal evidence | `VERIFIED_WORKING` for tested domains and outcomes | Same-day contract records real UI paths for five outcomes, DBMS/OS/Networks/DSA/System Design, goal scope and owner isolation. Current audit did not rerun them. |
| Retrieval relevance and source grounding | `PARTIALLY_WORKING` | Ownership, provenance and bounded retrieval exist; candidate selection is recency-limited before semantic ranking (Finding R-01). |
| Live-provider answer quality | `BLOCKED_EXTERNAL` / unmeasured | Last recorded live benchmark stopped after one connectivity failure; 0 human labels and 0 scoring-eligible v2 cases. |
| Production deployment and recovery | `IMPLEMENTED_UNVERIFIED` / launch-blocked | Runbooks exist, but actual production role, ingress, backup automation, isolated restore and operations are not verified. |

## Starting state and audit actions

- Git state before inspection: clean worktree, branch `main`, HEAD `e3b55b4` (`e3b55b477259a73ced7512617fd7a2af7c8c857b`). No tracked modifications or untracked files were present. Only this audit report was created; no implementation, dependencies, existing documentation, migrations, database roles, or learner data were changed.
- Package scripts were inspected before checks. `npm.cmd test` ran the server unit suite: **46 files passed, 213 tests passed, 4 opt-in provider tests skipped** (10.22 seconds). The skips are not live-provider verification.
- `npm.cmd run build` passed server TypeScript and client TypeScript/Vite production build. The main JS entry is **429.34 kB / 137.70 kB gzip**; route chunks are emitted separately. No current Vite 500 kB entry warning remains for the lazy-loaded entry.
- `git diff --check` will be run after this report is added. A read-only database identity query was not completed in this audit; same-day `PROJECT_STATUS.md` and `SECURITY_REVIEW.md` record the prior verified local target and role. No database connection/write was made here.
- PostgreSQL integration was not run: its `beforeAll` calls migration replay and `seedCanonicalQuestionBank()` (`server/tests/integration/postgres.integration.test.ts:29-35`), contrary to this audit's no-seed/no-migration boundary. E2E was not rerun because it creates and deletes database-backed disposable users. Its cleanup is described in the same-day status report; historical evidence is reported as prior evidence rather than a new pass. No live provider tests or calls were run.
- A one-off read-only DB probe was attempted but failed at Node argument parsing before the script reached a database connection; it made no DB changes. This audit does not claim fresh DB inventory.

## Architecture reality

### Frontend

- `client/src/main.tsx` mounts the React application/router. `client/src/App.tsx:1-29,35-70` lazy-loads the significant page modules and declares routes for landing/login/register, dashboard, knowledge check, review, readiness, study, recall, assessment, goals/baseline, plan, learner, settings, resources, remediation and knowledge catalog.
- Authenticated routes are nested under `Layout` (`App.tsx:41`); the page components call the shared `client/src/api/client.ts`. That client attaches the bearer token from `localStorage` (`client.ts:23-30`) and converts non-2xx JSON into `ApiError` (`client.ts:34-48`). This is simple and auditable but makes token theft a browser-storage risk; there is no cookie/CSRF session model.
- Pages and route components own most fetching and transient state. No shared query/cache framework is present; refresh persistence comes from re-fetching the API. This keeps state ownership explicit, but creates repeated loading/error logic across pages and no general cache invalidation layer. The audit found no indication of a second front-end assessment implementation.
- Readiness, assessment, review, resources and study are real API-backed pages. Empty/error branches exist in the inspected pages, and recorded Edge journeys test several. This audit did not visually inspect each page or rerun the full interaction suite.

### Backend request path

- `server/src/index.ts` validates runtime configuration, probes PostgreSQL with `connectDatabase()`, starts the app, then installs bounded shutdown (`index.ts:8-19`). It does not automatically apply migrations.
- `server/src/app.ts:9-18` orders optional proxy trust, response security headers, static-origin CORS, request telemetry, bounded JSON parsing, `/api` routes and the final error handler. Route registration is centralized in `server/src/routes/index.ts:19-37`; route modules declare auth and request admission controls.
- `server/src/lib/auth.ts` issues and verifies explicit HS256 expiring bearer JWTs. Authenticated services derive ownership from verified request identity. `authService` hashes with bcrypt and performs a dummy hash comparison for unknown accounts. The logout endpoint returns success but has no server-side revocation list; the client removes its local token.
- Controllers delegate to services; services use existing repositories and parameterized SQL. `server/src/db/postgres.ts:11-35` owns a single `pg` pool capped at 10 and a transaction helper with commit/rollback. Some services also issue SQL directly, so repository/data-access separation is not uniform.
- Important writes are grouped transactionally: assessment creation, baseline answer/completion/state update, recall result/evaluation/review-state update, study completion and source-linked study creation. Provider evaluation occurs before the recall write transaction; malformed/unavailable evaluation therefore leaves the attempt pending. Study extraction is prepared before session persistence and same-intent requests are reconciled with owner-scoped idempotency.
- Bounded rate and ingestion concurrency controls in `server/src/middleware/boundedLimits.ts` are in-memory per process. They protect one process but do not establish a distributed limit across replicas or restarts.

### Persistence and canonical knowledge

- PostgreSQL is the application source of truth. Migrations 001–029 are applied by an explicit custom order in `server/src/db/postgres.ts:37-54`; migration `029_study_session_idempotency.sql:1-7` adds an owner/key partial unique index. There is no migration ledger; the runbook says migration job must run once and schema changes are forward-only.
- User-owned rows generally use `user_id` and cascading foreign keys; canonical catalog rows are shared. Canonical role/skill/topic/concept/point IDs are distinct from learner goals, personal concepts and recall evidence. Assessment questions snapshot exact immutable canonical revisions; review decisions bind hashes and revisions.
- Recall point evidence is historical. My Readiness reduces submitted recall/baseline evidence at read time by canonical point, and distinguishes correct, partial, incorrect, unanswered and unassessed. Personal concept mastery and readiness are different projections: mastery is rolling signal, readiness is latest submitted point evidence. Custom or unmatched skills remain unmapped/unassessed.
- Current same-day status records zero assessment coverage for Backend Engineering's five points and sixteen blueprint gaps; the fallback is study/resources. Coverage numbers are eligibility counts, not validation that the questions are pedagogically correct.

### AI, source ingestion and remediation

- Study extraction and free-response evaluation use the configured `LLM_PROVIDER`; MCQ grading is deterministic. Embeddings use configured mock/deterministic or OpenAI-compatible providers. Remediation uses deterministic extractive output in mock mode or LLM structured output in live mode. Provider output is schema-validated; evaluation point labels are aligned/strictly validated; numeric evaluator overall coverage is derived from point statuses rather than trusted.
- Text, Markdown, public HTML, PDF and DOCX use one owner-scoped grounding path. PDF and DOCX preserve source positions, size/structure limits and content hashes; uploaded binaries are not retained. OCR and video transcript extraction are unavailable. Article fetching has URL/address/redirect/body/time controls. Source-linked retrieval is restricted to the source ID when present.
- Chunk embeddings are stored as PostgreSQL `real[]` plus model and dimension; no pgvector/vector index exists. Retrieval performs application cosine scoring over a small selected candidate set. The selected set's ordering defect is described in R-01.
- Prompts include source/learner text as JSON-encoded or quoted untrusted data and ask the model to stay grounded. This is a guardrail, not demonstrated prompt-injection resistance. No live provider result in this audit; most full-stack tests use deterministic mocks.

## Product journey map

The statuses below describe code plus available evidence, not just UI presence. `Prior evidence` means an earlier dated same-day report, not a command rerun in this audit.

| # | Journey | Trace and evidence | Audit classification / unverified branch |
|---:|---|---|---|
| 1 | Registration, login, onboarding, restore | Register/login UI → auth endpoints → bcrypt/user repository → `app_users` → token in browser storage; onboarding persists goal/skills. Earlier Edge report covers reload, logout, bad credentials, relogin and restored goal. | `VERIFIED_WORKING` on the recorded local path. JWT revocation/expiry behavior and multi-tab logout are not tested; copied tokens remain valid until expiry (R-05). |
| 2 | Dashboard initialization/continuation | Dashboard page and hook fetch `/api/dashboard`; service aggregates due work, sessions, mastery and counts; continuation links into current work. Earlier Edge report clicked primary destinations and persisted continuation. | `VERIFIED_WORKING` for exercised data state. No complete state-space test for empty/error/invalid continuation. |
| 3 | Learn something new | `/study/new` validates title/material and creates session with stable intent key; extraction is prepared before write; resulting `/study/:id` shows concepts and allows completion. | `VERIFIED_WORKING` for recorded deterministic-provider paths. Live extraction quality is unmeasured; raw study session has no per-field provenance beyond stored source URL/material. |
| 4 | Import text/documents | Resources UI → authenticated grounding API → bounded text/article/PDF/DOCX extraction → source/chunks/embeddings. Prior Edge and integration reports cover document citations and failure states. | `VERIFIED_WORKING` for tested parser inputs and local UI paths. OCR, video, true external article fetch from browser, adversarial files and broad format compatibility remain unsupported/unverified. |
| 5 | Extraction/canonical mapping | LLM or deterministic mock extraction validates concept schema; canonical linkage is exact normalized matching to selected catalog node/point rather than semantic mapping. | `PARTIALLY_WORKING`: safe exact mapping and unmapped fallback; semantic mapping accuracy and coverage completeness are not established. |
| 6 | Start/complete study | Study service checks owned processed source, locks source row while creating linked session, records source ID, then completion creates recalls/reviews transactionally. Migration 029 plus service/repository reconcile matching owner/key. | `VERIFIED_WORKING` in previous browser/integration reports. This audit did not re-run. |
| 7 | Test My Knowledge | Coverage endpoint applies exact current revision/hash/review/publication predicates; UI only offers supported blueprint modes; assessment creation snapshots question revisions and creates attempts transactionally. | `VERIFIED_WORKING` for eligible tested concepts; `PARTIALLY_WORKING` for catalog breadth (Backend Engineering is study-only). |
| 8 | Assessment submission/report | Recall UI posts selected option/text/parts; server grades and persists attempt/evaluation/point results; report summarizes counts, maturity and recommendation. | `VERIFIED_WORKING` as a deterministic test flow. LLM grading correctness has no independent benchmark ground truth (R-04). |
| 9 | Recall submission/evaluation | Recall service checks owner/pending attempt, validates answer/structured parts, evaluates before persistence, derives coverage and outcome, computes review state, then writes grouped evidence. | `VERIFIED_WORKING` for unit/recorded integration flow; live-provider semantic validity and provider failure timeouts in deployment are not established. |
| 10 | Weakness diagnosis | Evaluated missing/partial canonical points and recent attempt context drive deterministic recommendation; report retains the selected attempt ID. | `VERIFIED_WORKING` for recorded DBMS path; diagnosis appropriateness is not independently judged. |
| 11 | Grounded remediation/retrieval | Remediation retrieves owner/source-scoped chunks, ranks by cosine + lexical features, stores cited chunk links, then returns fallback resources if source evidence is insufficient. | `PARTIALLY_WORKING`: provenance and DB wiring pass; relevant evidence can be omitted by the candidate truncation (R-01); semantic relevance/teaching usefulness unmeasured. |
| 12 | Distinct verification | Selector requires unseen eligible non-MCQ revision mapped to diagnosed point; attempt and remediation linkage persist; success state derives from submitted verification outcome. | `VERIFIED_WORKING` for eligible concepts and recorded Edge path. No valid candidate yields honest resource fallback; catalog gaps remain. |
| 13 | Readiness and Goal Detail | Goal service reads latest submitted recall/baseline point evidence for exact mapped skills and groups outcomes; UI shows assessed/unassessed and next actions. | `VERIFIED_WORKING` for tested domains/outcomes and isolation per same-day report. Not all catalog roles or every malformed state were revalidated now. |
| 14 | Review & Improve | Due query reads `review_states`; recall submission persists evaluation plus deterministic interval/date update; old attempts remain. | `VERIFIED_WORKING` for success/partial/incorrect in previous Edge+integration report. Scheduler is an explicitly heuristic interval scheduler, not FSRS or evidence of durable retention. |
| 15 | Daily planning/task completion | UTC day windows, due/weak/goal tasks, deterministic selection and transactional replacement; task status PATCH is owner-scoped. | `VERIFIED_WORKING` for prior task-state reload checks. No longitudinal plan usefulness/overdue recovery study. |
| 16 | Learner history/progress | Summary and learner pages read personal concepts, submitted attempts, review and event state. | `IMPLEMENTED_UNVERIFIED` for breadth of history semantics. The principal evidence surface was covered through readiness and assessed journeys, but not every historical aggregation was independently reconciled in this audit. |
| 17 | Logout/account isolation | Logout clears local token; protected routes redirect; service reads bind owner ID and integration paths include cross-owner checks. | `VERIFIED_WORKING` for recorded path. Server logout is stateless, so a copied token stays usable until expiry; production token revocation is a product/security decision (R-05). |

## Ranked findings

Severity indicates engineering/product impact in the current repository, not exploit probability. Items marked **confirmed** follow directly from inspected code or recorded evidence. Risks and limits are labeled accordingly.

### R-01 — Retrieval truncates by recency before relevance ranking

- **Severity:** High. **Type:** confirmed retrieval correctness defect.
- **Evidence:** `server/src/repositories/groundingRepository.ts:53-59` orders candidate chunks by `s.created_at DESC, c.chunk_order`, queries up to 5,000 rows, then returns `result.rows.slice(0, limit)` (default 40). `server/src/services/grounding/groundedRemediationService.ts:156-171` only computes cosine/lexical relevance after receiving those rows.
- **Observed behavior:** remediation ranks at most the 40 newest-source / earliest-chunk rows returned by SQL, not the full 5,000-row candidate set. For a source with over 40 chunks, later chunks are excluded. Across a learner's sources, older relevant documents are excluded whenever 40 newer chunks precede them. Source-scoped retrieval limits this to the first chunk window of that source.
- **Impact/reproduction:** ingest a processed source with >40 chunks whose only relevant statement is after chunk 40, or add a newer unrelated source and leave the relevant source older. Request remediation for that point and inspect cited chunk IDs; candidate pages/sections later in the document or older source never reach ranking.
- **Correction direction:** apply relevance ordering before truncation. Prefer bounded SQL candidate selection plus vector/lexical ranking or a verified application-side scan with explicit per-user/source limits; preserve ownership, model/dimension filtering, source restriction and deterministic tie-breaking. Add a regression where the only matching chunk is outside the current 40-row window.
- **Dependencies/regression risk:** solution depends on chosen index/search strategy and data volume. Avoid loading arbitrary full source corpora into API memory; retain strict candidate and time limits. Existing source-scoping/citation E2E must remain.

### R-02 — Rate and concurrency limits are per-process only

- **Severity:** High before multi-instance deployment. **Type:** confirmed architecture limit, not a local single-process defect.
- **Evidence:** `server/src/middleware/boundedLimits.ts:4-33,36-55` stores windows and active counters in module-local `Map`/variables. The security review records 30 auth/study attempts and 60 recalls per IP/operation per 15 minutes, plus three ingestion slots per process. `docs/operations/DEPLOYMENT_RUNBOOK.md:22-25` requires ingress-wide limits.
- **Observed behavior:** restart resets counters; replicas independently admit traffic; a client routed across replicas can exceed the advertised per-process ceiling. The in-memory map has a 5,000-key cap and denies new keys while full of unexpired entries.
- **Impact:** abuse protection and ingestion CPU/memory ceilings are not global or durable. This does not invalidate one-process tests, but means they cannot prove a production ingress limit.
- **Correction direction:** enforce global connection/body/rate limits at trusted ingress and document whether application limits are defense-in-depth. If application-level cross-replica fairness is required, choose a shared store only after an actual deployment need exists. Test proxy IP trust settings in the deployed topology.
- **Dependencies/regression risk:** ingress/provider and trusted-proxy configuration. Incorrect `TRUST_PROXY_HOPS` can change client IP attribution; do not trust caller-supplied forwarded headers.

### R-03 — Production role and runtime controls are not launch-verified

- **Severity:** Critical launch blocker. **Type:** recorded environment finding plus unverified deployment controls.
- **Evidence:** `docs/security/SECURITY_REVIEW.md` 2026-11-02 Findings table records local role `recallloop` with `rolsuper`, `rolcreatedb`, `rolcreaterole` and database CREATE; its command table says PostgreSQL integration was not run for that review. `docs/PROJECT_STATUS.md:3-10` states current config is development-only and names least-privilege runtime role, production preflight, ingress limits, CSP/HSTS and restore drill as blockers. Production config checks are in `server/src/config/env.ts:32-77`.
- **Observed behavior:** production startup validates explicit PostgreSQL/JWT/HTTPS/provider configuration, but a valid application config does not ensure the DB role is least-privileged, the connection is encrypted, or the proxy and backup system are correct. Current local superuser must never be copied into production.
- **Correction direction:** provision a distinct runtime role with only required schema/table/sequence privileges and a separate migration principal; validate grants and TLS against intended infrastructure; run preflight and one disposable-account smoke there.
- **Dependencies/regression risk:** deployment owner, secrets, network and role provisioning. Do not change the local role or run migrations in this audit.

### R-04 — Evaluator quality is unknown; benchmark has no independent labels

- **Severity:** High product-trust risk. **Type:** confirmed evidence gap, not demonstrated grading bug.
- **Evidence:** `server/src/services/evaluator/llmEvaluator.ts:46-80,105-157` instructs the model to grade the answer against required points/rubric and derives coverage from returned statuses, with one malformed-output retry. `docs/AI_EVALUATION_BENCHMARK.md` says the 2026-11-01 run stopped after one outbound request, with no graded outputs; v2 has zero human labels and zero scoring-eligible cases (review status linked there). `docs/PROJECT_STATUS.md` records connectivity failure and no provider calls in the current validation.
- **Observed behavior:** structural JSON validity and deterministic contract fixtures prove parsing, mapping and persistence behavior. They do not measure agreement with qualified graders, calibration, domain bias, prompt-injection robustness, or false-correct frequency. The current development config is mock-backed; the last recorded network check was blocked before provider HTTP.
- **Impact:** a syntactically valid but educationally wrong score can become persisted evidence, alter review dates/readiness, and trigger the wrong remediation. No such current incorrect score was reproduced by this audit.
- **Correction direction:** obtain two independent blinded domain annotations and adjudication for the v2 benchmark; separate answer/rubric quality screening from model scoring; once a provider is reachable, run the bounded synthetic-only suite and analyze false-correct by class/domain before making grading-quality claims. Keep failure fail-closed.
- **Dependencies/regression risk:** independent reviewers and provider egress/access. Do not relabel provisional cases or use live learner content as a substitute.

### R-05 — Logout is client-side token removal, not token revocation

- **Severity:** Medium. **Type:** confirmed residual security behavior; not a defect if stateless logout is the accepted policy.
- **Evidence:** `server/src/controllers/authController.ts:31-33` responds `{ok:true}` without invalidating token state; `server/src/lib/auth.ts:20-48` verifies JWT signature/expiry only; `client/src/api/client.ts:73-75` calls logout but does not affect server validation. The UI's prior Edge path verifies local token removal and protected-route redirection.
- **Observed behavior:** after logout, the browser using that client loses access. A previously copied bearer token remains valid on another client until `JWT_EXPIRES_IN` expires, or the signing key is rotated.
- **Impact:** stolen tokens cannot be individually revoked by logout. Default local token lifetime is seven days (`env.ts:25-26`).
- **Correction direction:** explicitly choose/document the threat model. If immediate revocation is required, introduce a versioned session/token mechanism with bounded persistence and owner-scoped tests; otherwise shorten production lifetime and protect browser storage. Do not claim server-side revocation.
- **Dependencies/regression risk:** schema/session policy and multi-device behavior; avoid introducing a revocation table without product requirements.

### R-06 — Readiness latency change is not statistically established

- **Severity:** Medium performance follow-up. **Type:** confirmed measurement uncertainty, not confirmed regression.
- **Evidence:** `docs/performance/RECALLLOOP_PERFORMANCE_BASELINE.md` compares one before p95 (34.07 ms) with one after p95 (49.61 ms) at concurrency 10. The three additional after artifacts show readiness p95 116.52 ms, 66.31 ms and 74.63 ms (`docs/performance/results/repeat-2026-11-02-{a,b,c}.json`; 100 requests each). The same report states these are local samples, no production-size plan or capacity claim.
- **Observed behavior:** repeated-after spread is 50.21 ms (about 1.76× min-to-max); one after repeat exceeds the first after result by over 2×. No repeated before distribution or controlled run-order analysis exists. These samples cannot establish that the readiness implementation is slower/faster than baseline or explain the cause.
- **Correction direction:** defer query/index changes. If readiness latency becomes an acceptance/SLO concern, alternate matched before/after runs, capture data volume and warm/cold state, measure server/pool/DB components consistently, and inspect the complete readiness query plan on representative data.
- **Dependencies/regression risk:** no action is justified by this sample alone. A query rewrite may alter evidence precedence or ownership semantics; preserve the readiness integration regression.

### R-07 — No demonstrated encrypted backup automation or restore recovery

- **Severity:** High operational risk before learner production. **Type:** missing production evidence.
- **Evidence:** `docs/operations/DATABASE_BACKUP_AND_RESTORE.md` explicitly says backup/restore are procedures, not commands executed; no schedule, RPO/RTO, PITR or completed restore drill is demonstrated. `docs/PROJECT_STATUS.md:10` repeats encrypted automated backup and isolated restore as outstanding.
- **Observed behavior:** runbook gives safe manual `pg_dump`/`pg_restore` steps, but the repository contains no evidence that backups are generated, encrypted, retained, monitored or restorable by an operator.
- **Impact:** database loss, corruption or operator error could lose learner history; recovery time and recovery point are unknown.
- **Correction direction:** outside code-only scope, configure encrypted automated backups and retention in intended hosting, alert on failure, define RPO/RTO, and complete a restore into a verified isolated target before accepting real learners.
- **Dependencies/regression risk:** hosting, KMS/secret access and operations owner. A drill must never restore over the configured learner database.

### R-08 — CSP and HSTS depend on untested deployment edge

- **Severity:** High pre-launch hardening. **Type:** confirmed missing deployment evidence.
- **Evidence:** `server/src/middleware/securityHeaders.ts:3-9` sets nosniff, frame, referrer and permissions headers; no CSP/HSTS is set there. `docs/operations/DEPLOYMENT_RUNBOOK.md:22` says CSP/HSTS belong at the HTTPS frontend/proxy and must be validated against the built client. `docs/security/SECURITY_REVIEW.md` records no deployed CSP/browser compatibility test.
- **Observed behavior:** API responses have some protective headers; static client policy and transport security headers are not proven because the production host/proxy is not part of this repository test.
- **Impact:** no verified CSP defense-in-depth for XSS or strict transport policy. React escaping and no current dangerous HTML sink are positive controls, not substitutes for deployment headers.
- **Correction direction:** configure policy at the actual static host/proxy, initially report-only if needed, validate fonts/chunks/API routes and then enforce; verify HSTS only on the real HTTPS domain.
- **Dependencies/regression risk:** actual host, asset origins and API topology; do not add a restrictive CSP blindly in Express when it does not serve the app HTML.

### R-09 — Migrations replay ordered SQL without a migration ledger

- **Severity:** Medium operational risk. **Type:** confirmed design limitation, mitigated by documented process.
- **Evidence:** `server/src/db/postgres.ts:37-54` lists all migration files in explicit order and executes them; `docs/operations/DEPLOYMENT_RUNBOOK.md:18-20` says there is no migration ledger, migrations/seed SQL are reviewed, and one migration job should run per release. Integration bootstrap replays migrations and seeds the question bank.
- **Observed behavior:** the runner depends on every migration and seed being safely repeatable; it cannot report a canonical applied-version ledger, and parallel release jobs can replay the same statements. Historical fixes have already been needed to preserve review state across replay (migration 022, as documented).
- **Impact:** operational diagnosis and rollout compatibility rely on inspecting current schema/data and logs; concurrent migration jobs or an unrecognized non-idempotent historical change can fail or alter catalog rows.
- **Correction direction:** keep one serialized migration job; add a ledger only as a separately reviewed migration-runner milestone with bootstrap/adoption semantics, never infer deployed version from filenames alone. Keep integration tests isolated from learner DBs.
- **Dependencies/regression risk:** adoption of existing databases is delicate. Do not add a ledger casually or edit historical migration SQL.

### R-10 — Live model/provider work is synchronous in learner requests

- **Severity:** Medium reliability/scalability risk. **Type:** architectural constraint, not a confirmed current outage defect.
- **Evidence:** `server/src/services/evaluator/llmEvaluator.ts:105-157` awaits provider completion and retries malformed output once; `server/src/services/grounding/embeddingProvider.ts:31-55` gives embedding calls a 30-second timeout; `groundedRemediationService.ts:50-58,93-97,133-136,194-200` awaits embedding and persistence inside ingestion/remediation request flow. The performance runner uses deterministic providers and states provider latency was not measured.
- **Observed behavior:** users wait for external provider calls on extraction, free-response grading, embeddings and LLM remediation. There is no durable job queue or asynchronous processing state transition beyond synchronous `processing` updates.
- **Impact:** provider latency/availability directly affects request latency and user completion. Local mock performance measurements cannot quantify this path; upstream transient failures are fail-closed.
- **Correction direction:** first measure live-provider latency/error behavior in the intended environment and align proxy/request deadlines. Only consider background jobs if measured request deadlines/user needs require them; preserve idempotency and pending-state recovery.
- **Dependencies/regression risk:** provider terms/egress, async state and retry semantics. A queue would add operational complexity and is not recommended without evidence.

### R-11 — Backend Engineering is visible but has no assessable bank

- **Severity:** Medium product coverage gap. **Type:** confirmed content availability limitation.
- **Evidence:** same-day `docs/PROJECT_STATUS.md` reports five Backend Engineering points, zero current revisions and sixteen blueprint gaps; `KnowledgeCheckPage` requests coverage and server assessment selection only offers complete supported modes (`assessmentService.ts:68-95,107-143`). `KnowledgePage.tsx:12` still exposes the catalog role map.
- **Observed behavior:** canonical role/knowledge can be explored, but this domain cannot satisfy a knowledge-check blueprint. Honest server availability gating and study/resource fallback exist; no question content should be inferred from catalog presence.
- **Impact:** learners may interpret a visible role/domain as assessable even when it is study-only; the question check is unavailable until content is sourced, authored and reviewed.
- **Correction direction:** retain truthful study-only state in the learner-facing catalog and plan a separate source-grounded author/review milestone. Do not lower the blueprint or auto-approve candidates.
- **Dependencies/regression risk:** reviewed canonical points and authored items; no code change indicated if the current UI already communicates unavailability clearly.

### R-12 — Canonical mapping is conservative exact-text matching

- **Severity:** Medium learning-data limitation. **Type:** known model boundary.
- **Evidence:** `docs/DATA_MODEL.md` states personal concepts map by exact normalized name and point statements map only on unique exact normalized text within the selected canonical concept. Study flow validates the selected canonical parent/title; extracted content remains user-specific. Matching code is in `server/src/services/concept/conceptService.ts` and canonical linking helpers in the legacy repository.
- **Observed behavior:** defensible exact matches can retain canonical IDs; synonyms, paraphrases, multiple points with similar wording and new personal concepts remain unmapped rather than fuzzy-linked. Readiness excludes such unmapped point evidence from canonical skill counts.
- **Impact:** readiness may have less mapped evidence than the learner has actually submitted, and material extraction can appear incomplete even when conceptually equivalent. This is safer than false mapping but limits breadth.
- **Correction direction:** introduce reviewed explicit mapping suggestions with evidence and learner/curator confirmation only if the product needs them; never silently fuzzy-link. Measure false-positive/negative mapping on a reviewed corpus first.
- **Dependencies/regression risk:** canonical mapping provenance and correction history. Do not rewrite historical learner evidence automatically.

### R-13 — Current documentation embeds contradictory historical snapshots

- **Severity:** Low-to-medium maintenance risk. **Type:** confirmed documentation inconsistency.
- **Evidence:** `docs/PROJECT_STATUS.md` begins with 2026-11-02 sections describing the current reliability closure, then retains older entries saying source flow, baseline, auth and dashboard paths remain partial (`PROJECT_STATUS.md:3-10` vs later sections around lines 53-67 and 160+). `docs/CORE_FEATURE_COMPLETION.md` explicitly labels historical snapshots and says later evidence supersedes them, but the long file still presents a table and stale narratives. `docs/README.md` correctly says historical reports are snapshots and Project Status is current.
- **Observed behavior:** a reader must distinguish dated, superseded claims from the current top section; search results and excerpts can surface stale statements without their surrounding supersession context.
- **Impact:** audit handoffs can repeat already closed gaps or misstate current test counts. This audit did not edit existing docs under the brief.
- **Correction direction:** in a separate documentation cleanup, keep a short current status at the top, move dated evidence into an explicitly historical appendix or link the append-only session log, and add a generated-at/HEAD marker to current evidence reports.
- **Dependencies/regression risk:** documentation policy says session log is append-only; preserve historical records and update only source-of-truth summaries.

### R-14 — Data-access types permit broad `any` at domain boundaries

- **Severity:** Low-to-medium maintainability risk. **Type:** confirmed static inspection, not a reproduced runtime defect.
- **Evidence:** audited examples include `server/src/services/study/studySessionService.ts:111,114,143`, `server/src/services/goal/goalService.ts:75,90,106,123,125`, `server/src/services/grounding/groundedRemediationService.ts:149,185,199,208-210`, and `client/src/api/client.ts:143,147,151`. These sit in SQL row mapping and API response types, where current DTO shape is not fully checked by TypeScript.
- **Observed behavior:** the project builds, but casts can hide schema/contract drift; the broad prevalence is in compact SQL-mapping and CLI code, not all learner code.
- **Impact:** incorrect aliases/null assumptions may reach runtime despite a passing compile. No specific broken contract was reproduced in this audit.
- **Correction direction:** replace `any` incrementally at high-risk boundaries (persisted assessment/readiness, source provenance, error payloads) with explicit row and API DTO types; retain runtime validation for untrusted JSON. Avoid a blanket refactor.
- **Dependencies/regression risk:** type migration touches broad service signatures; add focused tests before changing serialized shapes.

## AI and educational quality assessment

- **Objective specificity:** canonical points are explicit strings and the question bank maps immutable revisions to point IDs. Some personal concepts still use extracted labels and exact text mapping, so coverage and competency identity are not uniform across canonical and personal study.
- **Answer contracts:** curated MCQs contain keys/explanations and non-MCQ revisions contain answer/rubric contracts. The engineering validators check shape, mapping, hashes and review state; they cannot guarantee factual correctness. SQL questions are not executed; written answer evaluation is not query-result validation.
- **Partial/missing distinction:** evaluator returns `correct | partial | missing` per point; service stores overall statuses (`incorrect` for low-coverage submitted text, `unanswered` for explicit blank skip). Readiness preserves these distinct outcomes. This is a useful evidence contract, not evidence that a provider labels them correctly.
- **Question eligibility:** selector verifies current revision, hash, valid/published state and approval policy; previous attempts are used in selection/exclusion. Automated review is separate from human review. Current benchmark v2 has no independent labels; automated approval must not be presented as SME sign-off.
- **Grounding:** source ID, chunk provenance, citation positions and owner/source constraints are implemented. Relevance is limited by R-01. The LLM remediation prompt says to use only excerpts and schema output is checked, but there is no automatic entailment verifier. Extractive mock remediation is intentionally deterministic, not an AI-quality proxy.
- **Unsupported learner claims:** source presence does not prove curriculum completeness or learner knowledge; browsing/studying does not itself add recall evidence. Readiness is evidence-only, uses latest point evidence, and leaves unknown points unassessed. No aggregate readiness score is invented.
- **Provider safety:** adapters have timeouts, bounded retries and sanitized error classifications; failure is not silently replaced by mock. Current external connectivity and provider consistency remain unverified. No provider call was made during this audit.
- **Overall product promise:** the software supports the full identify → evaluate → remediate → distinct verify flow for eligible cases, as prior Edge evidence records. It cannot yet claim reliable semantic grading or sustained learning improvement.

## Performance and scalability reality

- The existing benchmark is bounded and synthetic, uses local PostgreSQL and deterministic/mock providers, tests concurrency 1/5/10, and reports no production capacity claim. Its real API flows and cleanup make it more meaningful than a pure microbenchmark, but only ten disposable learners and one local host do not model production traffic.
- Dashboard aggregation moved from five sequential pool queries to one, and study completion from 41 pool calls in the baseline sample to five in the after sample. In the original matched single comparison at concurrency 10, dashboard p95 was 52.41 → 21.52 ms, and create/retry/complete/recall workflow p95 was 620.23 → 350.14 ms. Assessment submission p95 was 938.94 → 766.06 ms. These improvements are credible local observations, not an SLO/capacity result.
- Readiness is the outlier: original before/after was 34.07 → 49.61 ms; three additional after runs measured 116.52, 66.31 and 74.63 ms p95 (100 requests each). This is run-variable and cannot be assigned to a query-plan change based on current evidence. Query and DB operation metrics are partly instrumented; pool query attribution does not include every transaction-client query individually, as the performance report discloses.
- Grounding retrieval is CPU/application-side cosine scoring over `real[]` vectors without an ANN/vector index and has the R-01 candidate-window defect. Small tested data avoids proving how this behaves with a mature source library. Ingestion is synchronous and provider-dependent; local deterministic embedding latency does not represent remote embedding latency.
- Per-process `pg.Pool` maximum is 10 (`server/src/db/postgres.ts:11`). At multiple replicas total database sessions multiply by replica count; deployment must set aggregate pool budget against PostgreSQL `max_connections` and any proxy. No multi-instance benchmark was performed.
- Extended ingestion measured 40-page PDF API p95 around 1.12 s at concurrency 10, and process RSS increased from about 101 MiB to 288 MiB after the extended run; the report correctly says this is before/after RSS, not peak memory. No production memory/capacity inference is appropriate.

## Test evidence: what passes actually prove

| Layer | Current evidence | What it proves / does not prove |
|---|---|---|
| Unit | Reran `npm.cmd test`: 46 files, 213 passed, 4 opt-in provider checks skipped. | Strong deterministic coverage of service rules, parsing, selectors, scheduler, security/config and error contracts. It does not validate a real PostgreSQL schema/session or provider quality. |
| PostgreSQL integration | Not run during this audit. Same-day status records 22/22 from an earlier run; current integration bootstrap migrates and seeds canonical bank. | Earlier result is supporting evidence only; it was not reproduced today and is unsafe to execute under this audit constraint. |
| Edge E2E | Not run during this audit. Same-day status records successful Edge against local API/PostgreSQL with disposable-account cleanup. | Prior real UI/API/database trace is valuable; this audit does not claim a new browser pass, and no production environment was exercised. |
| Build | Reran `npm.cmd run build`: passed server `tsc`, client `tsc --noEmit`, and Vite build. | Types compile and production assets bundle; does not prove route behavior or successful deployment CSP/base URL. |
| Live provider | Not run; 4 opt-in tests skipped. Prior benchmark stopped after one sanitized network failure and 34 unattempted cases. | No evaluator agreement, reliability, rate-limit, cost or educational-quality metric. |
| Security | Current source review and same-day targeted tests/status. No full adversarial penetration or all-dependency advisory query. | Controls exist and selected unit/browser paths pass; no security certification. Offline production-only audit count is a prior report; full npm audit endpoint unavailable. |
| Performance | Reviewed raw JSON reports; no benchmark run in this audit. | Local comparative response/query observations only; no production capacity or SLO proof. |

Notable test infrastructure boundary: `server/vitest.integration.config.ts` pins deterministic provider settings, and `server/tests/integration/postgres.integration.test.ts:29-35` replays all migrations and calls `seedCanonicalQuestionBank()` in `beforeAll`. Do not run that suite against a learner database just to refresh a pass. Use an explicitly disposable integration database in a future change to the harness/setup policy.

## Documentation reality and discrepancies

- `docs/README.md` correctly directs readers to Project Status for current verification and treats reports as historical snapshots. This audit did not modify any existing documentation.
- `docs/PROJECT_STATUS.md` now has current 2026-11-02 sections at the top, but keeps many older status statements later in the same long file, some saying core paths are partial. They are dated, but easy to quote without the date/supersession context. Use the top sections and `CORE_FEATURE_COMPLETION.md` as current contract; treat lower dated snapshots as historical only.
- `docs/CORE_FEATURE_COMPLETION.md` is extensive and includes a current final-closure section plus earlier contradictory snapshots. The document itself labels older sections as superseded; it still increases audit navigation cost. A later cleanup can consolidate current rows without deleting append-only session history.
- `docs/ARCHITECTURE.md`, `FLOW.md`, and `DATA_MODEL.md` describe the single pool, route/service/repository flow, idempotency and readiness data sources consistently with source. `DATA_MODEL.md` should be amended in a future routine documentation task to mention R-01's actual ranking candidate window; the existing description “bounded set” is too general to reveal that recency trimming occurs before scoring.
- `docs/security/SECURITY_REVIEW.md`, `THREAT_MODEL.md`, `SECURITY_CONFIGURATION.md` and `docs/operations/*` do not claim production certification; they explicitly list local-superuser, ingress limits, CSP/HSTS, provider/backup and restore blockers. These are aligned and appropriately cautious.
- `docs/performance/RECALLLOOP_PERFORMANCE_BASELINE.md` presents the single readiness before/after as regression and separately cautions that samples are small. Three raw repeated after results show high variability and should accompany that claim in any future performance summary; this audit does not rewrite the historical report.
- `docs/AI_EVALUATION_BENCHMARK.md` and the v2 review artifacts are candid: provisional labels remain unvalidated, zero human labels, zero scoring-eligible cases, and no live outputs. No quality claim is warranted.
- `docs/SESSION_LOG.md` is append-only and contains dates/snapshots; this audit did not append because the brief permitted only one file creation. The final report is the only new artifact.

## Priority order: next three engineering milestones

### 1. Correct and regression-test retrieval candidate selection

Fix R-01 first. Ensure semantic/lexical scoring occurs over an explicitly bounded candidate set that can include older sources and later chunks. Prove with unit and PostgreSQL regressions that the only relevant chunk beyond the current 40 window is retrieved, citations remain exact, source-scoped retrieval remains isolated, and memory/query cost remains bounded. Re-run the existing real Edge remediation journey against a disposable DB learner. Do not add a vector service solely to patch ordering.

### 2. Establish independent evaluator ground truth and provider availability

Complete v2 blinded annotations/adjudications with qualified reviewers. Once outbound connectivity and credentials/access are available in an authorized environment, run the capped synthetic benchmark against the production evaluator. Report agreement, false-correct cases and uncertainty by domain/class; revise rubric/prompt/model policy only from observed errors. Keep all learner records out of benchmark inputs.

### 3. Close production operations prerequisites before any launch claim

Provision least-privilege runtime/migration DB roles; verify TLS, exact HTTPS origin and production provider setup; configure ingress-wide rate/body/time limits and CSP/HSTS at the real host; configure monitored encrypted backup/retention; define RPO/RTO and pass an isolated restore drill; verify full dependency advisories and ownership/on-call. Exercise health, shutdown and one disposable learner smoke against intended infrastructure. Until then, remain explicitly not production-ready.

## Audit closeout

The system has meaningful working learner journeys and sound integrity patterns for owner-scoped access, immutable question attempts, transactional evidence, latest-evidence readiness and source-session idempotency. The strongest confirmed product correctness finding is retrieval's recency-first candidate truncation. The most important unresolved trust issue is unmeasured live evaluator quality. The most important launch blockers are the database privilege/deployment boundary, distributed abuse limits, browser policy headers and unproven backups/restores. All reported limitations are grounded in checked source or explicitly dated repository evidence; unknowns are not presented as failures.

## 2026-11-02 — Retrieval correction and finding status

This is an append-only update; the original audit findings and evidence remain unchanged. The retrieval fix changes application behavior but does not refresh database, provider, browser, or deployment evidence. PostgreSQL integration was inspected but not run because its bootstrap replays migrations and seeds the canonical question bank against the configured application database. No database or provider operation was performed.

| Finding | Current status | Evidence and regression coverage | Remaining limitation / next dependency |
|---|---|---|---|
| R-01 Retrieval candidate truncation | **Fixed in code; integration not yet executed.** | `retrieveChunks` now selects a bounded stable chunk-ID pool (up to 5,000) without source-recency/chunk-order sorting; `retrieveForGap` relevance-ranks that pool before final selection. Controlled service/repository-boundary tests passed and an actual PostgreSQL regression was added. | Stable-ID selection is an approximation above 5,000 chunks, not a semantic index. The test harness used a mocked SQL boundary; validate the new database query against an explicitly disposable PostgreSQL target before making production latency claims. |
| R-02 Per-process limits | **Unchanged; deployment risk remains.** | Source and security documentation still describe local in-memory auth/study/recall and ingestion limits. No shared ingress test was added. | Configure and verify trusted ingress-wide limits and proxy attribution for the intended multi-instance topology. |
| R-03 Database privilege and production controls | **Unchanged; launch-blocked.** | The latest checked security/status documents record the configured `recallloop` role as superuser/CREATEDB/CREATEROLE; this task did not re-query roles or modify database configuration. | Provision distinct least-privilege runtime and migration roles; verify TLS and production preflight in the intended environment. |
| R-04 Evaluator quality | **Unchanged; quality evidence gap.** | Current benchmark documentation retains 35 provisional v2 cases, zero independent annotations/adjudications, and zero scoring-eligible cases. No provider request was made. | Obtain independent domain annotations/adjudication; run the bounded synthetic benchmark only in an authorized environment with provider connectivity. |
| R-05 Logout token revocation | **Unchanged; accepted-policy decision remains.** | Reviewed behavior remains client-side token removal with signed-token expiry; this correction does not change auth or session state. | Decide whether production requires immediate revocation; if so, design and test a versioned session mechanism. |
| R-06 Readiness latency evidence | **Unchanged; regression is not established.** | Existing performance report still shows the single 34.07→49.61 ms p95 comparison and variable repeated-after samples. The retrieval fixture is separate and does not measure readiness. | Run matched repeated readiness benchmarks and inspect representative query plans only if an SLO warrants it. |
| R-07 Backups and restore | **Unchanged; launch evidence missing.** | Existing runbook still documents procedures without a demonstrated encrypted automated backup or isolated restore drill. No backup/restore operation was performed. | Configure monitoring/retention and complete an isolated restore with explicit RPO/RTO. |
| R-08 CSP/HSTS | **Unchanged; deployment evidence missing.** | Existing security/runbook documents still assign CSP/HSTS to the real frontend/HTTPS ingress; no deployed host was tested. | Configure and validate report-only/enforced CSP and HSTS at the actual host. |
| R-09 Migration ledger/replay | **Unchanged; design limitation remains.** | No migration or runner changed. Inspection confirmed the integration bootstrap still replays migrations and calls `seedCanonicalQuestionBank()`. | Keep one serialized migration job; consider a ledger only as a separate adoption-safe migration project. |
| R-10 Synchronous provider work | **Unchanged; architectural constraint.** | Ingestion, embedding and live remediation remain synchronous; this task added no queue/provider. | Measure authorized live-provider latency and request deadlines before considering asynchronous work. |
| R-11 Backend Engineering coverage | **Latest documented status unchanged; not refreshed from the database.** | Current checked status documents still report five catalog points, zero current revisions and sixteen blueprint gaps. No coverage command/database query was run. | Refresh eligibility only in an explicitly safe read-only database check; reviewed content is still the prerequisite to coverage. |
| R-12 Exact-text canonical mapping | **Unchanged; conservative model boundary.** | Existing data-model/source documents still describe exact normalized matching; no mapping logic or historical evidence changed. | Consider reviewed mapping suggestions only if measured product need justifies them. |
| R-13 Historical documentation snapshots | **Partially improved only for retrieval status; general issue remains.** | Grounded-remediation, project-status, and core-completion documents now state this fix and its limits. Older dated snapshots remain intact and can still be confusing. | A separate documentation consolidation should preserve append-only history and clearly supersede stale sections. |
| R-14 Broad `any` at domain boundaries | **Unchanged; maintainability risk remains.** | Focused changes did not address broad row/API typing; existing `query<any>` mappings remain in the grounding persistence boundary. | Replace types incrementally with explicit row/DTO contracts and focused regressions. |

### Carried-forward operating and product constraints

- Database role separation, intended-environment production preflight, staging, encrypted backups/restore, ingress-wide limits, deployed CSP/HSTS, and a complete online dependency audit remain open. No role, database, migration, seed, or deployment work was performed.
- AI v2 remains 35 cases with provisional labels, zero independent annotations and adjudications, and no scoring-eligible cases; no provider request was made.
- The readiness p95 comparison remains 34.07 ms versus 49.61 ms at concurrency 10, with three variable after repeats; it is unrelated to the retrieval fixture.
- Latest checked documentation still reports Backend Engineering at five catalog points, zero current revisions, and sixteen blueprint gaps; that inventory was not refreshed from PostgreSQL. The inspected question service still uses built-in templates and curated MCQs rather than a general LLM question-generation path. Scanned-PDF OCR and automatic video transcription remain unsupported, and ingestion/embedding remain synchronous.
- Current retrieval performance evidence is a single deterministic in-memory fixture, not a PostgreSQL benchmark: 5,005 fixture rows; old/new ranked candidate counts 40/5,000; old/new selection 0.663/20.252 ms; old/new ranking 0.657/27.613 ms; old/new pipeline total 1.389/82.710 ms (updated includes deterministic embedding); final context 0/107 characters; memory not measured. These measurements establish the bounded application-side trade-off only.

**Current priority:** first execute the new PostgreSQL retrieval regression against an explicitly disposable database and measure query/ranking latency there; preserve the existing candidate cap and all source/owner eligibility predicates. Then continue the independent evaluator-ground-truth and production-operations milestones. Readiness profiling remains separate.

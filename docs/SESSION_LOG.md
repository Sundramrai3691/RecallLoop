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

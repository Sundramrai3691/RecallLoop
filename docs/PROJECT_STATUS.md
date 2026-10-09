# Project status

Status is based on checked-in source and test files as of 2026-10-09. This is not a claim about any deployed environment or production usage.

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
| PostgreSQL runtime and ordered migrations | IMPLEMENTED | `server/src/db/*`, migrations `001`–`010`. |
| Authenticated goals, skills, plans, and dashboard | IMPLEMENTED | Goal/dashboard services and authenticated routes. |
| Canonical knowledge, baseline and learner summaries | IMPLEMENTED | Knowledge/baseline/learner services and migration `001`. |
| Study sessions, recall, evaluation, scheduling | IMPLEMENTED | Study/recall/evaluator/scheduler services and core migration. |
| Assessment sessions, hints, question selection | IMPLEMENTED | Question/assessment services, migration `004`–`008`. |
| Resource recommendations and learning packs | IMPLEMENTED | Resource services and routes. |
| Grounding ingestion, retrieval, remediation and verification | IMPLEMENTED | Grounding services/routes and migration `010`. |
| Unit-level tests | TESTED | `npm test` passed in this session: 8 files, 32 tests. |
| Client and server production builds | TESTED | `npm run build` passed in this session. |
| PostgreSQL integration tests | BLOCKED LOCALLY | `npm run test:integration -w server` was attempted; all 3 cases were skipped after setup failed with `ECONNREFUSED 127.0.0.1:5432`. The suite includes the real grounding and verification flow but did not execute in this session. |
| Current developer API startup | BLOCKED LOCALLY | Reported `ECONNREFUSED 127.0.0.1:5432`; `server/src/index.ts` probes PostgreSQL before listening. Start PostgreSQL, apply migrations, then rerun `npm run dev`. |
| Manual browser exercise | UNKNOWN | No browser exercise was performed in this documentation session. |
| Production deployment, uptime, data population | UNKNOWN | No deployment/runtime telemetry is available in the repository. |

## Local verification commands

```powershell
docker compose up -d postgres
npm run db:migrate -w server
npm run db:seed -w server
npm run dev
```

The compose file defines PostgreSQL 16 on port 5432. If Docker is unavailable, provide a PostgreSQL instance matching `DATABASE_URL` in `.env`. Apply migrations before the first API run; startup itself only runs `SELECT 1`.

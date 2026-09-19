# Project Audit — RecallLoop

Date: 2026-09-19

## Current architecture

The repository was empty at audit time: a Git working tree with no application source, no `package.json`, no frontend, no backend, and no database layer.

Because there is no meaningful existing architecture, the MVP is implemented as a two-package npm workspace using the requested default stack:

- **Frontend:** React, TypeScript, Vite, React Router, hand-written CSS
- **Backend:** Node.js, Express, TypeScript
- **Database:** MongoDB + Mongoose
- **AI:** Provider interface with mock fallback when no API key is present
- **Package manager:** npm workspaces

## Important existing files

At audit time:

| Path | Status |
|------|--------|
| `.git/` | Present (empty project history aside from git metadata) |
| Application source | **Missing** |
| `package.json` | **Missing** |
| `.env` / `.env.example` | **Missing** |
| Tests | **Missing** |
| Docs | **Missing** |

## Existing data flow

None. No HTTP routes, API client, or persistence existed.

## Reusable components

Nothing to reuse. All MVP modules are new and intentionally small.

## Missing components (needed for MVP)

1. Domain models: StudySession, Concept, RecallAttempt, ReviewState
2. REST API for study, recall, concepts, dashboard
3. Concept extraction (LLM + mock) with JSON validation
4. Immediate recall generation on session complete
5. Rubric evaluator (LLM + mock) with retry/validation
6. Isolated deterministic scheduler (not FSRS)
7. Dashboard UI and study/recall pages
8. Central frontend API client
9. Environment handling and `.env.example`
10. Tests for completion, concepts, recall, evaluation parse, scheduler, duplicate submit
11. Architecture / implementation documentation

## Implementation plan

1. Scaffold `server/` and `client/` workspaces; add MongoDB via docker-compose for local runs.
2. Implement Mongoose models matching the specified domain.
3. Implement services (`study`, `concept`, `recall`, `evaluator`, `scheduler`) with thin Express controllers.
4. Wire REST routes listed in the product spec.
5. Build the page flow: `/dashboard` → `/study/new` → `/study/:id` → `/recall/:id` → `/recall/:id/result`.
6. Default to mock LLM so the full loop works without keys.
7. Add Vitest unit + integration tests (MongoDB memory server for API flow).
8. Document architecture, runbook, and implementation report.

## Risks / assumptions

- **No auth:** `userId` is optional; MVP uses a local default user id (`local-user`).
- **MongoDB required** to run the app (not for scheduler unit tests). `docker compose up -d` is the supported local database.
- **MVP scheduler is not FSRS.** Interval policy is a placeholder behind `services/scheduler/`.
- **Mock mode is keyword/heuristic based**, not pedagogically equivalent to a real evaluator.
- **Immediate recall is synchronous** (no queues). Fine for MVP; not for high-volume extraction later.
- **Single-user local product** until authentication is added.

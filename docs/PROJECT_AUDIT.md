# Project Audit — RecallLoop

Date: 2026-09-24

## Current architecture

RecallLoop is already a two-package npm workspace. This audit inspected the live tree rather than assuming a blank project.

- **Frontend:** React 19, TypeScript, Vite, React Router, hand-written CSS (`client/`)
- **Backend:** Node.js, Express, TypeScript (`server/`)
- **Database:** MongoDB + Mongoose
- **AI:** `LlmProvider` interface with OpenAI-compatible HTTP and mock fallback
- **Package manager:** npm workspaces (root `package.json`)
- **Tests:** Vitest + Supertest + mongodb-memory-server

```
Browser → Vite :5173 (/api proxy) → Express :3001 → MongoDB
                                 ↘ evaluator (mock | LLM)
                                 ↘ scheduler (deterministic IntervalScheduler)
```

## Important existing files

| Path                                                                                | Role                                              |
| ----------------------------------------------------------------------------------- | ------------------------------------------------- |
| `package.json`                                                                      | Workspace scripts: `dev`, `test`, `build`         |
| `.env.example`                                                                      | `MONGODB_URI`, `PORT`, `LLM_*`                    |
| `docker-compose.yml`                                                                | Local MongoDB 7                                   |
| `server/src/index.ts`                                                               | API process entry                                 |
| `server/src/app.ts`                                                                 | Express factory                                   |
| `server/src/routes/index.ts`                                                        | `/api` routers                                    |
| `client/src/main.tsx`                                                               | Frontend entry                                    |
| `client/src/App.tsx`                                                                | Routes for dashboard / study / recall             |
| `client/src/api/client.ts`                                                          | Central HTTP client                               |
| `server/src/db/connect.ts`                                                          | Mongoose connection                               |
| `server/src/config/env.ts`                                                          | Env + mock-LLM detection                          |
| `server/src/models/*`                                                               | StudySession, Concept, RecallAttempt, ReviewState |
| `server/src/services/{study,concept,recall,evaluator,scheduler,dashboard,question}` | Domain logic                                      |
| `client/src/pages/*`                                                                | UI flow                                           |
| `client/src/hooks/useDashboard.ts`                                                  | Dashboard fetch (no business logic)               |

**Authentication:** JWT bearer authentication is available through `/api/auth/register`, `/api/auth/login`, and `/api/auth/me`. Goal, plan, and learner routes require an authenticated learner. The original study/recall MVP routes remain compatible with the legacy local-user flow.

**Existing routes:** health, auth, goals/skills, today plan, learner summary, study sessions, recalls, concepts, and dashboard.

## Existing data flow

1. `POST /api/study-sessions` creates a session and extracts concepts.
2. `POST /api/study-sessions/:id/complete` marks complete and creates immediate explain recalls + `ReviewState(dueAt=now)`.
3. `POST /api/recalls/:id/submit` evaluates, stores rubric, updates mastery, schedules next review.
4. `GET /api/dashboard` lists due/upcoming/recent/mastery.
5. `POST /api/goals/:id/plan/generate` creates a deterministic plan with learning and recall tasks informed by due reviews and weak concepts.
6. `GET /api/learner/summary` exposes deterministic mastery, weakness, confidence, due-review, and mistake signals.

Frontend pages call only `client/src/api/client.ts`.

## Reusable components

Everything listed above was reused. Controllers stay thin. Evaluator and scheduler are already isolated. CSS/layout (`Layout`, `index.css`) was kept.

## Missing components (before this pass)

The vertical slice was already present. Gaps closed in this pass:

1. Coverage could follow an LLM-supplied number instead of knowledge-point statuses.
2. Extracted concepts were stored without a second validation gate.
3. Completed study pages had no path back into pending recalls.
4. Dashboard fetch lived in the page instead of a hook.
5. Audit docs still described an empty repository.

Not included in this foundation: FSRS, queues, Redis, social, and notifications.

## Implementation plan

1. Keep existing stack; do not rewrite.
2. Derive coverage from rubric statuses; align LLM points to required points.
3. Validate extracted concepts with Zod before insert.
4. Return `pendingRecalls` on `GET /api/study-sessions/:id`.
5. Wire study page “Continue pending recall”; extract `useDashboard`.
6. Refresh docs; run Vitest.
7. Add JWT auth plus goal, skill, plan, and learner-model infrastructure without changing the original study/recall flow.

## Risks / assumptions

- **The legacy study/recall endpoints still use their existing local-user compatibility path; new goal/plan/learner endpoints are user-scoped.**
- **MongoDB required** to run the app (memory server for tests).
- **MVP scheduler is not FSRS.** Documented at `services/scheduler/`.
- **Mock evaluation is lexical overlap**, not pedagogically equivalent to a live model.
- **URL/file sources** are labels; material is still pasted text.
- **Immediate extraction is synchronous.**

## Phase 3 additions

- PostgreSQL schema and curated seed for canonical roles, skills, topics, concepts, knowledge points, provenance, and resources.
- Baseline assessment tables distinguish assessed evidence from self-declared knowledge.
- Deterministic starting-point and resource recommendation services respect learner time.
- The final Mongo runtime removal requires the explicit import/cutover sequence in `docs/PHASE3_MIGRATION_PLAN.md`; no dual-write implementation is intended.

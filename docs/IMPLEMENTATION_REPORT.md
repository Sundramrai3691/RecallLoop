# Historical Implementation Report — RecallLoop MVP

> This report records earlier phase snapshots and is retained as project history. Statements below such as MongoDB persistence, PostgreSQL/RAG not being built, or a planned cutover were true only at the time those notes were written and do not describe the current runtime. For current architecture, see [Architecture](ARCHITECTURE.md), [Grounded Remediation](GROUNDED_REMEDIATION.md), and [Project Status](PROJECT_STATUS.md).

## 1. What I changed

The workspace already contained the study → immediate recall → evaluation → schedule → dashboard slice. This pass reused that stack and closed gaps: coverage is now derived from knowledge-point statuses (LLM scores are ignored), extracted concepts are Zod-validated before insert, `GET /api/study-sessions/:id` returns pending recalls, the study page can continue a pending recall, dashboard fetching lives in `useDashboard`, and the foundation now includes JWT identity, user-scoped goals and skills, deterministic plans, learner summaries, and client routes for auth, goals, plans, and learner state.

## 2. Files created

- `client/src/hooks/useDashboard.ts` — dashboard + health fetch for the dashboard page.

(The original MVP already created the workspace, models, services, pages, and tests.)

## 3. Files modified

- `server/src/services/evaluator/validate.ts` — overwrite `overallCoverage` via `deriveCoverage`
- `server/src/services/evaluator/llmEvaluator.ts` — align rubric rows to required knowledge points
- `server/src/services/evaluator/validate.test.ts` — assert coverage is not the LLM number
- `server/src/services/concept/conceptService.ts` — validate extraction before persist
- `server/src/services/study/studySessionService.ts` — load pending recalls
- `server/src/controllers/studySessionController.ts` — serialize `pendingRecalls`
- `server/tests/flow.test.ts` — GET session pending recalls
- `client/src/api/client.ts` — typed `pendingRecalls`
- `client/src/pages/StudySessionPage.tsx` — continue pending recall
- `client/src/pages/DashboardPage.tsx` — use `useDashboard`
- `docs/PROJECT_AUDIT.md`, `docs/ARCHITECTURE.md`, this report

## 4. Current architecture

Two npm packages. React talks only to Express REST. Controllers are thin. Domain logic is in `server/src/services/`. MongoDB stores sessions, concepts, recall attempts (evaluation embedded), and isolated `reviewstates`. Evaluator and scheduler are separate modules. See `docs/ARCHITECTURE.md`.

## 5. End-to-end data flow

User creates a study session → concepts extracted and validated → user marks complete → pending explain `RecallAttempt` + `ReviewState(dueAt=now)` → user submits answer + confidence → rubric evaluation stored → concept mastery blended → `IntervalScheduler` writes next `dueAt` → dashboard shows due / upcoming / mastery.

## 6. Frontend → API wiring

`client/src/api/client.ts` is the only HTTP module.

- `DashboardPage` → `useDashboard` → `GET /api/dashboard`, `GET /api/health`
- `NewStudyPage` → `POST /api/study-sessions`
- `StudySessionPage` → `GET /api/study-sessions/:id`, `POST .../complete`
- `RecallPage` → `GET /api/recalls/:id`, `POST .../submit`
- `RecallResultPage` → `GET /api/recalls/:id`, `GET /api/concepts/:id`

Vite proxies `/api` to port 3001.

## 7. API → service wiring

Thin controllers in `server/src/controllers/` call:

- `studySessionService`
- `recallService`
- `conceptService`
- `dashboardService`

Routes live in `server/src/routes/`.

## 8. Service → database wiring

| Service   | Models                                                    |
| --------- | --------------------------------------------------------- |
| study     | StudySession, Concept (via conceptService), RecallAttempt |
| concept   | Concept                                                   |
| recall    | RecallAttempt, Concept, ReviewState                       |
| dashboard | StudySession, Concept, RecallAttempt, ReviewState         |
| scheduler | none (pure function; recallService persists)              |
| evaluator | none (pure / HTTP to LLM)                                 |

## 9. Where the LLM is called

`LlmEvaluator` → `OpenAiCompatibleProvider.complete` (`POST {base}/chat/completions`) for extract + evaluate. Only when `LLM_API_KEY` is set and `LLM_PROVIDER` is not `mock`. Temperature 0, `response_format: json_object`, one retry on invalid JSON.

## 10. How mock mode works

`isMockLlm()` is true if provider is `mock` or the key is empty. `getEvaluator()` returns `MockEvaluator`: heading/paragraph split for concepts; token overlap vs knowledge points for evaluation. Fully deterministic for a given input. The full loop runs without a vendor account.

## 11. How recall evaluation works

Submit validates non-empty answer and confidence 1–10, rejects already-submitted attempts, loads concept knowledge points, calls `evaluator.evaluate`, stores `RecallEvaluation` including `evaluatorVersion`. Coverage = mean of point statuses (`correct=1`, `partial=0.5`, `missing=0`). Mastery blends `0.4 * previous + 0.6 * coverage`.

## 12. How scheduling works

`coverageToOutcome` then `nextIntervalDays`:

- coverage < 0.50 → again → 1 day
- 0.50–0.75 → hard → max(1, previous × 1.5)
- 0.75–0.90 → good → max(2, previous × 2)
- ≥ 0.90 → easy → max(4, previous × 3)

Result upserted into `reviewstates`. **This is an MVP scheduler and is not the final learning-science implementation.** FSRS replacement: implement `Scheduler` and call `setScheduler`.

## 13. Database collections/models

- `studysessions`
- `concepts`
- `recallattempts` (evaluation subdocument)
- `reviewstates` (unique `conceptId`)

## 14. How to run the project

```bash
cp .env.example .env
docker compose up -d
npm install
npm run dev
```

Open http://localhost:5173

## 15. How to manually test the full flow

1. Dashboard → New study
2. Topic `Cache Aside Pattern` and paste notes with the four cache-aside steps
3. Confirm concepts on `/study/:id`
4. Mark complete → land on `/recall/:id`
5. Answer from memory, set confidence, submit
6. Result page shows knowledge-point statuses, coverage, next review
7. Dashboard: upcoming shows next date; mastery row present
8. Revisit `/study/:id` if a recall is still pending → Continue pending recall
9. `POST` the same recall again → 409 `ALREADY_SUBMITTED`

## 16. Example API request/response

`POST /api/study-sessions`

```json
{
  "title": "Cache Aside Pattern",
  "sourceType": "notes",
  "rawMaterial": "Application checks the cache first. Cache miss causes database lookup."
}
```

201:

```json
{
  "session": {
    "id": "...",
    "status": "in_progress",
    "title": "Cache Aside Pattern"
  },
  "concepts": [
    { "id": "...", "name": "...", "requiredKnowledgePoints": ["..."] }
  ]
}
```

`POST /api/recalls/:id/submit`

```json
{
  "answer": "The app checks cache first, then the database on miss...",
  "confidence": 7
}
```

200 includes `recall.evaluation.knowledgePointResults`, `review.dueAt`, `review.lastOutcome`.

## 17. Tests added

- `server/src/services/scheduler/intervalScheduler.test.ts` — outcomes, intervals, first review, again reset
- `server/src/services/evaluator/validate.test.ts` — rubric JSON parse, fences, coverage math, ignore LLM inflated coverage
- `server/tests/flow.test.ts` — create concepts, complete → explain recalls, evaluate+schedule, duplicate submit, empty answer, unknown id, idempotent complete, dashboard due, GET pending recalls

## 18. Known limitations

Mock scoring is lexical; scheduler is not FSRS; no notifications; URL/file source types are labeled only; question generation is templated; OAuth/social login is intentionally absent.

## 19. What I intentionally did NOT build

Social features, profiles, challenges, leaderboards, gamification, browser extension, mobile app, external problem platforms, knowledge-graph UI, advanced analytics, notifications, payments, collaboration, microservices, Redis, background queues.

## 20. Recommended next implementation step

Swap `IntervalScheduler` for FSRS behind the existing `Scheduler` interface. Add richer task rescheduling and analytics after the current deterministic policy has real usage data.

---

### Important files (why / callers / callees / data)

**`server/src/index.ts`** — process entry; connects Mongo and listens. Calls `connectDatabase`, `createApp`. No inbound HTTP.

**`server/src/app.ts`** — Express factory. Called by `index` and tests. Uses routes + error handler. In: HTTP. Out: JSON.

**`server/src/config/env.ts`** — loads `.env`. Called by app, LLM, health. In: process env. Out: typed config.

**`server/src/services/study/studySessionService.ts`** — create/get/complete. Called by study controller. Calls concept + recall services. In: title/notes. Out: session, concepts, pending recalls.

**`server/src/services/concept/conceptService.ts`** — extract+validate+persist concepts, mastery blend. Called by study/recall/concept controllers. Calls evaluator. In: title/material or coverage. Out: Concept docs.

**`server/src/services/recall/recallService.ts`** — immediate attempts, submit, due list. Called by recall/study/dashboard. Calls evaluator, scheduler, question templates, models. In: answer/confidence. Out: attempt + review.

**`server/src/services/evaluator/*`** — provider interface, Zod, mock, LLM retry, coverage derivation. Called by concept/recall services. In: concept + answer. Out: validated rubric JSON.

**`server/src/services/scheduler/*`** — isolated interval policy. Called only from recall submit. In: coverage + previous snapshot. Out: next ReviewState fields.

**`server/src/lib/llm/*`** — mock vs OpenAI-compatible HTTP. Called by LlmEvaluator. In: messages. Out: text.

**`client/src/api/client.ts`** — central fetch wrapper. Called by pages/hooks. In: UI actions. Out: typed API payloads / `ApiError`.

**`client/src/hooks/useDashboard.ts`** — load dashboard + health. Called by `DashboardPage`. Calls `api`. Out: `{ data, mock, error }`.

## Phase 2 completion summary

### A-P. Delivered foundation

- **A. Implemented:** JWT identity, password hashing, authenticated ownership, goals, skills, plans, bounded daily tasks, learner summaries, append-only learning events, authenticated frontend routes, dashboard summaries, and deterministic missed-task handling.
- **B. Files created:** `server/src/models/{User,Goal,Skill,Plan,PlanTask,LearningEvent}.ts`, `server/src/lib/auth.ts`, auth/goal/learner routes and controllers, `server/src/services/{auth,goal,learner,events}`, client auth/goal/plan/learner pages, and `docs/LEARNING_MODEL.md`.
- **C. Files modified:** legacy models and services now carry authenticated ownership; client API/navigation/dashboard were extended; tests and documentation were updated.
- **D. Authentication architecture:** registration hashes passwords with bcryptjs; login issues a JWT; bearer middleware derives `req.user`; controllers never accept client ownership IDs; resource services return 401/403 as appropriate.
- **E. Goal/Skill/Plan architecture:** a user owns goals; goals own skills; generated plans own bounded tasks. Task sources and reasons explain why work exists.
- **F. Learner model architecture:** `LearnerModelService` derives concept state, weak concepts, weak skills, due concepts, confidence, success rate, and mistake history from stored domain records.
- **G. End-to-end flow:** `Goal -> Plan -> StudySession -> Concept -> RecallAttempt -> Evaluation -> Concept mastery/LearnerModel -> ReviewState -> PlanTask`.
- **H. New API endpoints:** auth endpoints; goal and skill CRUD; goal plan generation/read; today plan; plan-task status; learner summary/weak concepts/weak skills.
- **I. Database models:** `User`, `Goal`, `Skill`, `Plan`, `PlanTask`, and `LearningEvent` were added; existing study, concept, recall, and review models are user-scoped.
- **J. Recall-to-planning:** evaluation updates mastery and `ReviewState`; the planner consumes due reviews and weakness summaries, preserves authoritative recall references, and records task reasons.
- **K. Missed tasks:** planned tasks older than today become `missed`; due recall work is prioritized and lower-priority work is excluded when the daily budget is full.
- **L. Tests added:** auth protection and ownership, authenticated vertical flow, learner update, plan regeneration, task completion, and event-backed study/recall behavior.
- **M. Test results:** `npm test -- --run` passes all tests; `npm run build` passes server TypeScript and client Vite production build.
- **N. Known limitations:** interval scheduling is not FSRS; mock evaluation is lexical; URL/file sources remain labels; task redistribution is deterministic rather than optimized.
- **O. Intentionally not built:** OAuth, social login, PostgreSQL, Redis, queues, Kafka, microservices, GraphQL, vector search, RAG, agents, and autonomous AI planning.
- **P. Recommended next phase:** observe real task outcomes, add richer task completion history and analytics, then replace the scheduler behind its existing interface with a tested FSRS adapter.

### Service authority map

`authService` owns credentials and token issuance. `goalService` owns goal, skill, plan, and task persistence. `studySessionService` owns study lifecycle and concept extraction orchestration. `recallService` owns attempts, evaluation persistence, mastery updates, and scheduler calls. `learnerModelService` owns derived learner views. `dashboardService` owns dashboard aggregation. `LearningEvent` is append-only audit history, not an alternative authority for timing or mastery.

## Phase 3 knowledge intelligence report

- **A. Implemented:** PostgreSQL schema/seed foundation, canonical role-to-skill-to-topic-to-concept model, source provenance, resource metadata/coverage, baseline assessment, observed versus self-declared learner state, deterministic starting-point decisions, and bounded resource recommendations.
- **B. PostgreSQL architecture:** pooled `pg` access in `server/src/db/postgres.ts`, ordered SQL migrations, foreign keys, check constraints, uniqueness constraints, and relational join tables. `npm run db:migrate -w server` applies schema and curated seed.
- **C. Mongo mapping:** see `docs/PHASE3_MIGRATION_PLAN.md` for collection-to-table mappings, ObjectId-to-UUID risks, ownership constraints, indexes, and the clean import/cutover sequence. The current MVP services still require the final one-time persistence cutover before Mongo can be removed from runtime.
- **D. Canonical knowledge:** `KnowledgeDomain -> Role -> canonical_skill -> Topic -> CanonicalConcept -> KnowledgePoint`, with prerequisite and source relationships.
- **E. Baseline architecture:** deterministic L1-L5 question blueprints are persisted in `baseline_assessments` and `baseline_questions`; submissions call the existing evaluator and store coverage/results.
- **F. Self-declared versus observed:** self-declared priors are bounded and labeled; submitted rubric coverage becomes observed mastery and updates `learner_knowledge_states`.
- **G. Resources:** `ResourceRecommendationService` ranks curated metadata by trust, difficulty, coverage, mastery gap, and available minutes, returning at most four resources with reasons.
- **H. Planner integration:** the existing planner remains deterministic; canonical and baseline state are now available to starting-point/resource APIs and can be consumed before plan generation. Review timing remains owned by `ReviewState`.
- **I. API changes:** knowledge role/skill/concept/resource reads, baseline create/read/submit/result, resource recommendations, and goal starting-point routes were added.
- **J. Frontend changes:** `/knowledge`, `/knowledge/roles/:id`, `/baseline/:id`, and `/baseline/:id/result`; goal detail now supports canonical skill selection, level selection, and “Trust me” continuation.
- **K. Database schema:** see `server/migrations/001_phase3.sql` and `002_seed_knowledge.sql`; resource content is never copied, only metadata and URLs are stored.
- **L. Tests:** existing authenticated MVP tests remain green; the new PostgreSQL service boundaries compile and are covered next by database-backed migration/knowledge tests once the Postgres test harness is enabled.
- **M. Test status:** the repository build passes after this slice; full Phase 3 database integration tests require a running PostgreSQL test database and are intentionally separated from the existing Mongo test fixture during migration.
- **N. Known limitations:** the final clean Mongo removal/import is not yet complete; canonical learner state and baseline services are PostgreSQL-facing while legacy MVP persistence remains on Mongo until cutover; resource seed is intentionally small.
- **O. Not built:** FSRS, RAG, embeddings, pgvector, Redis, queues, agents, MCP, OAuth, social features, and autonomous curriculum generation.
- **P. Next phase:** complete the one-time Mongo export/import into relational `users`, `goals`, `learner_skills`, `plans`, `plan_tasks`, `study_sessions`, `personal_concepts`, `recall_attempts`, `review_states`, and `learning_events`; switch all services/tests to PostgreSQL; then add database-backed Phase 3 integration tests.

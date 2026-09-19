# Implementation Report — RecallLoop MVP

## 1. What I changed

The repository was an empty Git tree. I added a runnable npm workspace with a React/Vite client, an Express/TypeScript API, MongoDB models, mock+LLM evaluators, an isolated interval scheduler, the study → immediate recall → evaluation → schedule → dashboard vertical slice, tests, and documentation.

## 2. Files created

Root: `package.json`, `.gitignore`, `.env.example`, `docker-compose.yml`, `README.md`, `docs/PROJECT_AUDIT.md`, `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_REPORT.md`

Server: Express app, models, routes, controllers, services (`study`, `concept`, `recall`, `evaluator`, `scheduler`, `question`, `dashboard`), LLM provider layer, Vitest tests.

Client: Vite React app, API client, pages for dashboard / new study / session / recall / result.

## 3. Files modified

None existed besides `.git`. After this task, all application files are new.

## 4. Current architecture

See `docs/ARCHITECTURE.md`. Two packages, REST between them, Mongoose persistence, evaluator and scheduler isolated.

## 5. End-to-end data flow

User creates a study session → concepts extracted and stored → user marks complete → pending explain `RecallAttempt` + `ReviewState(dueAt=now)` → user submits answer → rubric evaluation embedded on the attempt → concept `mastery` updated → scheduler writes next `dueAt` → dashboard reads pending attempts and future `ReviewState` rows.

## 6. Frontend → API wiring

`client/src/api/client.ts` is the only HTTP module. Pages:

- `DashboardPage` → `GET /api/dashboard`, `GET /api/health`
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

| Service | Models |
|---------|--------|
| study | StudySession, Concept (via conceptService), RecallAttempt (via recallService) |
| concept | Concept |
| recall | RecallAttempt, Concept, ReviewState |
| dashboard | StudySession, Concept, RecallAttempt, ReviewState |
| scheduler | none (pure function; recallService persists) |
| evaluator | none (pure / HTTP to LLM) |

## 9. Where the LLM is called

`LlmEvaluator` → `OpenAiCompatibleProvider.complete` (`POST {base}/chat/completions`) for extract + evaluate. Only when `LLM_API_KEY` is set and `LLM_PROVIDER` is not `mock`.

## 10. How mock mode works

`isMockLlm()` is true if provider is `mock` or the key is empty. `getEvaluator()` then returns `MockEvaluator`: heading/paragraph split for concepts; token overlap vs knowledge points for evaluation. Fully deterministic for a given input.

## 11. How recall evaluation works

Submit validates non-empty answer and confidence 1–10, rejects already-submitted attempts, loads concept knowledge points, calls `evaluator.evaluate`, stores `RecallEvaluation` including `evaluatorVersion`, blends mastery `0.4 * previous + 0.6 * coverage`.

## 12. How scheduling works

`coverageToOutcome` then `nextIntervalDays`. Result upserted into `reviewstates`. **This is an MVP scheduler and is not the final learning-science implementation.** FSRS replacement: implement `Scheduler` and call `setScheduler`.

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
7. Dashboard: pending empty (if all answered); upcoming shows next date; mastery row present
8. `POST` the same recall again → 409 `ALREADY_SUBMITTED`

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
  "session": { "id": "...", "status": "in_progress", "title": "Cache Aside Pattern" },
  "concepts": [{ "id": "...", "name": "...", "requiredKnowledgePoints": ["..."] }]
}
```

`POST /api/recalls/:id/submit`

```json
{ "answer": "The app checks cache first, then the database on miss...", "confidence": 7 }
```

200 includes `recall.evaluation.knowledgePointResults`, `review.dueAt`, `review.lastOutcome`.

## 17. Tests added

- `server/src/services/scheduler/intervalScheduler.test.ts` — outcomes, intervals, first review, again reset
- `server/src/services/evaluator/validate.test.ts` — rubric JSON parse, fences, coverage math
- `server/tests/flow.test.ts` — create concepts, complete → explain recalls, evaluate+schedule, duplicate submit, empty answer, unknown id, idempotent complete, dashboard due

## 18. Known limitations

No auth; mock scoring is lexical; scheduler is not FSRS; no notifications; URL/file source types are labeled only (content still pasted as text); question generation is templated; single local user.

## 19. What I intentionally did NOT build

Social features, profiles, challenges, leaderboards, gamification, browser extension, mobile app, external problem platforms, knowledge-graph UI, advanced analytics, notifications, payments, collaboration, microservices, Redis, background queues.

## 20. Recommended next implementation step

Add real user authentication and bind `userId` on all collections so review state is per learner. After that, swap `IntervalScheduler` for FSRS behind the existing `Scheduler` interface.

---

### Important files (why / callers / callees / data)

**`server/src/index.ts`** — process entry; connects Mongo and listens. Calls `connectDatabase`, `createApp`. No inbound HTTP.

**`server/src/app.ts`** — Express factory. Called by `index` and tests. Uses routes + error handler. In: HTTP. Out: JSON.

**`server/src/config/env.ts`** — loads `.env`. Called by app, LLM, health. In: process env. Out: typed config.

**`server/src/services/study/studySessionService.ts`** — create/get/complete. Called by study controller. Calls concept + recall services. In: title/notes. Out: session, concepts, recalls.

**`server/src/services/concept/conceptService.ts`** — extract+persist concepts, mastery blend. Called by study/recall/concept controllers. Calls evaluator. In: title/material or coverage. Out: Concept docs.

**`server/src/services/recall/recallService.ts`** — immediate attempts, submit, due list. Called by recall/study/dashboard. Calls evaluator, scheduler, question templates, models. In: answer/confidence. Out: attempt + review.

**`server/src/services/evaluator/*`** — provider interface, Zod, mock, LLM retry. Called by concept/recall services. In: concept + answer. Out: validated rubric JSON.

**`server/src/services/scheduler/*`** — isolated interval policy. Called only from recall submit. In: coverage + previous snapshot. Out: next ReviewState fields.

**`server/src/lib/llm/*`** — mock vs OpenAI-compatible HTTP. Called by LlmEvaluator. In: messages. Out: text.

**`client/src/api/client.ts`** — central fetch wrapper. Called by pages. In: UI actions. Out: typed API payloads / `ApiError`.

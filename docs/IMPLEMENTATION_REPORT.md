# Implementation Report — RecallLoop MVP

## 1. What I changed

The workspace already contained the study → immediate recall → evaluation → schedule → dashboard slice. This pass reused that stack and closed gaps: coverage is now derived from knowledge-point statuses (LLM scores are ignored), extracted concepts are Zod-validated before insert, `GET /api/study-sessions/:id` returns pending recalls, the study page can continue a pending recall, dashboard fetching lives in `useDashboard`, docs were rewritten from the empty-repo audit, and tests were extended.

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

| Service | Models |
|---------|--------|
| study | StudySession, Concept (via conceptService), RecallAttempt |
| concept | Concept |
| recall | RecallAttempt, Concept, ReviewState |
| dashboard | StudySession, Concept, RecallAttempt, ReviewState |
| scheduler | none (pure function; recallService persists) |
| evaluator | none (pure / HTTP to LLM) |

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
- `server/src/services/evaluator/validate.test.ts` — rubric JSON parse, fences, coverage math, ignore LLM inflated coverage
- `server/tests/flow.test.ts` — create concepts, complete → explain recalls, evaluate+schedule, duplicate submit, empty answer, unknown id, idempotent complete, dashboard due, GET pending recalls

## 18. Known limitations

No auth; mock scoring is lexical; scheduler is not FSRS; no notifications; URL/file source types are labeled only; question generation is templated; single local user.

## 19. What I intentionally did NOT build

Social features, profiles, challenges, leaderboards, gamification, browser extension, mobile app, external problem platforms, knowledge-graph UI, advanced analytics, notifications, payments, collaboration, microservices, Redis, background queues.

## 20. Recommended next implementation step

Add real user authentication and bind `userId` on all collections so review state is per learner. After that, swap `IntervalScheduler` for FSRS behind the existing `Scheduler` interface.

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

# Request and function flows

This is a source-derived map of the current implementation. HTTP routes are mounted under `/api` in `server/src/routes/index.ts`; route modules show authentication, controllers delegate to services, and SQL is issued through repositories or service queries using the shared `pg` pool. Names below refer to current source symbols. Error responses pass through `server/src/middleware/errorHandler.ts`.

## Runtime request path

`client/src/pages/*` / `client/src/hooks/*` → `client/src/api/client.ts` → Vite `/api` proxy → `server/src/app.ts` (`express.json`, CORS) → `server/src/routes/index.ts` → route middleware (`requireAuth` where declared) → controller → service → repository/parameterized SQL → PostgreSQL → JSON response → client page state.

`server/src/index.ts` calls `connectDatabase()` (`SELECT 1`) before `app.listen`. A refused PostgreSQL connection prevents the API from listening; Vite can still start, but its `/api/*` proxy calls then fail. Startup does not run migrations automatically. Use the setup sequence in the root README.

## HTTP surface

All endpoints use JSON. `requireAuth` routes derive `userId` from the verified token; canonical knowledge reads and health are public.

| Route | Access | Handler / purpose |
|---|---|---|
| `GET /api/health` | Public | Inline in `routes/index.ts`; process/config health (does not probe DB per request). |
| `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | Public except logout/me | `authController`; account, token, current-user operations. |
| `GET/POST /api/goals`, `GET/PATCH/DELETE /api/goals/:id` | Auth | `goalController`; goal CRUD. |
| `GET /api/goals/:goalId/starting-point`; `POST/GET /api/goals/:goalId/skills`; `PATCH/DELETE /api/goals/skills/:id` | Auth | Starting-point and learner-skill operations. |
| `POST /api/goals/:goalId/plan/generate`, `GET /api/goals/:goalId/plan`, `GET /api/plan/today`, `PATCH /api/plan/tasks/:id` | Auth | Generate/read plan and change task state. |
| `POST /api/baseline`, `GET /api/baseline/:id`, `POST /api/baseline/:id/submit`, `GET /api/baseline/:id/result` | Auth | Baseline assessment lifecycle. |
| `GET /api/knowledge/roles`, `/roles/:id`, `/skills/:id`, `/concepts/:id`, `/concepts/:id/resources` | Public | Canonical knowledge catalog and linked resources. |
| `GET /api/learner/summary`, `/weak-concepts`, `/weak-skills`; `GET /api/dashboard` | Auth | Learner evidence and dashboard summaries. |
| `POST /api/study-sessions`, `GET /:id`, `POST /:id/complete` | Auth | Study-session lifecycle and concept extraction. |
| `GET /api/concepts`, `GET /:id`, `PATCH /:id/review` | Auth | Personal concepts and review preferences. |
| `GET /api/recalls/due`, `GET /:id`, `POST /:id/hints`, `POST /:id/submit` | Auth | Recall attempt lifecycle. |
| `POST /api/assessments`, `GET /:id` | Auth | Assessment session creation and progress. |
| `GET/PATCH /api/settings` | Auth | Per-user settings. |
| `GET /api/resources/recommendations`, `GET /api/resources/learning-pack` | Auth | Resource and learning pack recommendations. |
| `GET/POST /api/grounding/sources`, `GET /api/grounding/sources/:id` | Auth | User-owned grounding source ingestion and reads. |
| `POST /api/remediations/from-attempt/:attemptId`, `GET /:id`, `POST /:id/verify` | Auth | Grounded remediation lifecycle. |

Route definitions: `server/src/routes/*.ts`. Client calls are centralized in `client/src/api/client.ts`.

## Important workflows

| Workflow | Call chain and effects | Failure / transaction notes |
|---|---|---|
| 1. Register | `authRouter` → `registerHandler` → `registerUser` → `userRepository`; password hashed before insert; session token returned. | Duplicate/invalid credentials become API errors; no cross-domain transaction. |
| 2. Login/current user | `loginHandler` → `loginUser`; later `requireAuth` verifies bearer token and `/auth/me` → `getCurrentUser`. | Invalid/expired token rejected by auth middleware; user ownership comes from claims. |
| 3. Create goal and skills | `goalController` → `goalService.createGoal/createSkill` → goal/learner-skill repositories. | Goal ownership is checked before nested operations. |
| 4. Choose starting point | `startingPointController` → starting-point service queries goal, canonical requirements and learner state; Trust Me can use baseline assessment path. | Missing or foreign goal is not exposed as another user's data. |
| 5. Baseline assessment | `baselineController` → `baselineService.createBaseline/submitBaselineQuestion`; questions and assessment are persisted, final learner knowledge state updated. | Final submission writes assessment and learner states within `withTransaction`; invalid assessment/question/owner rejected. |
| 6. Read canonical knowledge | `knowledgeController` → `knowledgeService` → SQL over domains, roles, skills, topics, canonical concepts, knowledge points, sources/resources. | Public read; not learner-owned records. |
| 7. Create study session and extract concepts | `studySessionController.createStudySessionHandler` → session service → concept extraction evaluator → schema validation → personal concept persistence. | LLM/provider or schema errors fail extraction; durable concept writes are scoped to authenticated user/session. |
| 8. Complete study session | `completeStudySessionHandler` → `studySessionService.completeStudySession` → transaction updating session, creating immediate recall/review work and recording event. | `withTransaction` rolls back grouped writes on error. |
| 9. Start assessment | `assessmentController` → `assessmentService.createAssessment` → deterministic question selector/templates → assessment session and attempts in PostgreSQL. | Mode/concept ownership validated; assessment creation groups ordered attempt writes in a transaction. |
| 10. Get/reveal recall hint | `recallController` → `recallService.getRecall/revealRecallHint` → owned attempt/question read or atomic hint counter update. | Hidden hints are not included until revealed; no hint beyond configured allowance. |
| 11. Submit MCQ answer | `submitRecallHandler` → `submitRecall` → persisted answer key grading (`evaluateMcq`) → result/evidence persistence, mastery and review schedule update. | Attempt must belong to user and be pending; derived coverage comes from knowledge-point outcomes. |
| 12. Submit free-form recall | Same controller/service → evaluator (mock or configured LLM) → JSON/schema validation → derive coverage → transaction persists attempt, evaluation, point results, dimension results, mastery, review state and learning event. | Evaluation occurs before transaction; transaction makes durable result state atomic; errors roll back. |
| 13. Read learner model | `learnerController` → `learnerModelService` summary/weak concepts/weak skills → user-scoped aggregate queries over attempts, evaluations, concepts, skills and review states. | Concepts without assessment evidence remain new/null rather than assigned fabricated scores. |
| 14. Generate daily plan | `goalController.generateGoalPlanHandler` → `goalService.generateGoalPlan` → candidate selection/budget fitting → plan repositories replace future planned tasks. | Task replacement runs transactionally; budget constrained by API validation and migration checks. |
| 15. Read today's plan | `GET /plan/today` → `goalService.getTodayPlan` → active plan/tasks and due review data → serialized task list. | Empty state returned when no active plan; owner scope enforced. |
| 16. Update plan task | `PATCH /plan/tasks/:id` → `goalService.updatePlanTask` → owned task status update and event where implemented. | Invalid status or foreign task rejected. |
| 17. Get dashboard | `dashboardController` → `dashboardService.getDashboard` → user-scoped aggregates/joins for goals, today's tasks, recall, learner state. | Query failure becomes common API error; no write. |
| 18. Recommend resources / learning pack | `resourceController` → resource recommendation or pack service → coverage, learner signals, goal and time-fit ranking. | Deterministic ranking; no write to learner state. |
| 19. Ingest grounding source | `groundingController` → `ingestGroundingSource` → hash and deterministic chunking → embedding provider → source/chunk repositories. | Source processing status/error recorded; chunk insertion is transactional; only user-provided text is ingested (no URL fetch). |
| 20. Remediate and verify a gap | `createRemediationHandler` → `createGroundedRemediation` → attempt/point evidence → user-scoped retrieval/ranking → validated generator → persist remediation; verification creates targeted assessment/recall attempt and later updates status. | Low relevance or unsupported generation does not fabricate evidence; source retrieval scoped by owner; relevant grouped writes use transactions. |

The service names above are confirmed in `server/src/services`. Not every single SQL query has a repository wrapper; several domain services query the shared database module directly. Transaction details are implemented by `server/src/db/postgres.ts::withTransaction` and the call sites.

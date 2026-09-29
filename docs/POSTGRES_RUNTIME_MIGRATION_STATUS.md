# PostgreSQL Runtime Migration Status

Date: 2026-09-30

## Migrated services

- `authService` -> `userRepository` -> `app_users`
- `goalService` -> goal, learner-skill, plan, and plan-task repositories -> `goals`, `learner_skills`, `plans`, `plan_tasks`
- `studySessionService` -> PostgreSQL session/concept repositories -> `study_sessions`, `personal_concepts`
- `conceptService` -> personal concept repository -> `personal_concepts`
- `recallService` -> PostgreSQL recall/review data access -> `recall_attempts`, `recall_evaluations`, `recall_knowledge_point_results`, `review_states`
- `dashboardService` -> PostgreSQL joins/aggregations -> user-scoped core tables
- `learnerModelService` -> PostgreSQL learner queries -> personal concepts, attempts, evaluations, reviews, learner skills
- `learningEventService` -> PostgreSQL insert -> `learning_events`
- canonical knowledge, baseline, starting-point, and resource services -> PostgreSQL tables

## Repository coverage

Implemented PostgreSQL repository modules currently cover users, goals, learner skills, plans, plan tasks, study sessions, concepts, recalls, reviews, and shared event persistence. Canonical knowledge and baseline use their PostgreSQL query services. Repository interfaces are in `server/src/repositories/types.ts`.

## Remaining Mongo imports

Production source has no remaining `mongoose`, Mongo, ObjectId, Mongoose model, `MONGODB_URI`, or `local-user` references. Mongo model files and Mongo-memory fixtures were removed after the service cutover.

## Transactions

Study completion, recall submission, normalized evaluation persistence, review updates, event writes, and plan-task replacement use `withTransaction` client-bound transactions. The next hardening item is adding rollback assertions to the live PostgreSQL integration suite.

## Tests

- Unit tests: 9 passed (`evaluator` validation and deterministic scheduler).
- PostgreSQL integration test: available through `npm run test:integration -w server`.
- Integration status: BLOCKED in this environment because Docker is unavailable and PostgreSQL is not listening on `127.0.0.1:5432`.
- Build: server and client pass.

## Blockers and next actions

1. Start PostgreSQL and run `npm run db:migrate -w server` and `npm run db:seed -w server`.
2. Convert multi-write repository functions to `withTransaction` client operations.
3. Add PostgreSQL end-to-end integration coverage for auth, goals, study, recall, learner, dashboard, rollback, ownership, and idempotency.
4. Run the final repository-wide Mongo search and verify dependency lockfile state.

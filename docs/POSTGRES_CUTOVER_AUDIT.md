# PostgreSQL Cutover Audit

Date: 2026-09-30

## Current data stores

The server currently has two persistence paths:

- MongoDB/Mongoose is the runtime authority for the existing application domain.
- PostgreSQL `pg` pool and migrations exist for the Phase 3 canonical knowledge, baseline, resource, and starting-point slices, but are not yet connected to application startup and are not a replacement for Mongo.

This is a migration gap, not an intended dual-write design. The final cutover must select PostgreSQL as the only runtime store and remove Mongo entirely.

## Mongo dependencies found

| Dependency                                           | Current use                                          | Replacement                                                         |
| ---------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------- |
| `server/src/db/connect.ts`                           | `mongoose.connect`, disconnect, strict query setup   | `server/src/db/postgres.ts` pool and explicit shutdown              |
| `server/src/models/User.ts`                          | Mongoose User model                                  | `UserRepository` over `users`                                       |
| `server/src/models/Goal.ts`                          | Goal documents and ObjectId goal relationships       | `GoalRepository` over `goals`                                       |
| `server/src/models/Skill.ts`                         | Learner skills and goal ObjectIds                    | `SkillRepository` over `learner_skills`                             |
| `server/src/models/Plan.ts`                          | Plan upsert and lookup                               | `PlanRepository` over `plans`                                       |
| `server/src/models/PlanTask.ts`                      | Task creation, status updates, due lookup            | `PlanTaskRepository` over `plan_tasks`                              |
| `server/src/models/StudySession.ts`                  | Study lifecycle                                      | `StudySessionRepository` over `study_sessions`                      |
| `server/src/models/Concept.ts`                       | Personal concepts and mastery                        | `ConceptRepository` over `personal_concepts`                        |
| `server/src/models/RecallAttempt.ts`                 | Attempts and embedded evaluation                     | `RecallAttemptRepository` plus `recall_evaluations` and result rows |
| `server/src/models/ReviewState.ts`                   | Scheduler state                                      | `ReviewStateRepository` over `review_states`                        |
| `server/src/models/LearningEvent.ts`                 | Append-only history                                  | `LearningEventRepository` over `learning_events`                    |
| `server/src/services/auth/authService.ts`            | `User.findOne`, `findById`, `create`                 | User repository                                                     |
| `server/src/services/goal/goalService.ts`            | Goal/skill/plan/task queries and writes              | Goal, skill, plan, task repositories                                |
| `server/src/services/study/studySessionService.ts`   | Session reads/writes and recall queries              | Study session, concept, recall, review repositories in transactions |
| `server/src/services/concept/conceptService.ts`      | Concept insert/list/mastery updates                  | Concept repository                                                  |
| `server/src/services/recall/recallService.ts`        | Attempt/review/concept queries and updates           | Recall, concept, review, event repositories                         |
| `server/src/services/learner/learnerModelService.ts` | Aggregation over concepts, attempts, reviews, skills | Learner query repository/read model                                 |
| `server/src/services/dashboard/dashboardService.ts`  | Dashboard aggregation and due creation               | Dashboard read repository plus recall/review repositories           |
| `server/src/services/events/learningEventService.ts` | `LearningEvent.create`                               | Learning event repository                                           |
| `server/tests/flow.test.ts`                          | `mongodb-memory-server`, Mongoose cleanup            | PostgreSQL integration database                                     |
| `server/tests/auth-goal-plan.test.ts`                | `mongodb-memory-server`, Mongoose cleanup            | PostgreSQL integration database                                     |
| `server/package.json`                                | `mongoose`, `mongodb-memory-server`                  | Remove after cutover; retain `pg`                                   |
| `docker-compose.yml`                                 | `mongo` service and volume                           | Remove Mongo; retain PostgreSQL                                     |
| `.env.example` and `server/src/config/env.ts`        | `MONGODB_URI`                                        | Remove after `DATABASE_URL` cutover                                 |

## Mongo operation inventory

The current services use Mongoose `.find`, `.findOne`, `.findById`, `.create`, `.save`, `.findOneAndUpdate`, `.deleteOne`, `.deleteMany`, `.sort`, `.limit`, `.select`, `.lean`, and `.populate`. Mongo-specific values include `mongoose.Types.ObjectId`, `Schema.Types.ObjectId`, `$lte`, `$gt`, `$exists`, `$in`, `$or`, `upsert`, and embedded evaluation documents.

These must become parameterized SQL with explicit joins, `INSERT ... ON CONFLICT`, `UPDATE ... RETURNING`, `DELETE`, date predicates, and normalized evaluation rows. Mongo ObjectIds must never be cast to UUIDs.

## Migration order

1. Create relational tables, constraints, indexes, and migration bookkeeping.
2. Add repository interfaces and PostgreSQL implementations without changing domain service contracts.
3. Add relational tables for existing MVP entities, including normalized recall evaluations.
4. Replace auth and goal/plan persistence first, because all later rows depend on ownership.
5. Replace study sessions and concepts.
6. Replace recall attempts, evaluations, and review states in transaction boundaries.
7. Replace learner and dashboard read models.
8. Add an explicit Mongo export/import utility with source-to-target ID maps, counts, orphan checks, and rerun protection.
9. Reconcile `local-user` development data to a documented development account or discard it through a clean reset.
10. Switch startup to PostgreSQL only, remove Mongo dependencies/configuration, and run the full PostgreSQL integration suite.

## Transaction boundaries

- Study completion: session status, concept/recall creation, review state, and study/review events must share one transaction.
- Recall submission: attempt, normalized evaluation rows, mastery, review state, and events must share one transaction.
- Plan generation: plan replacement and task replacement should be one transaction.
- Baseline submission: question result, assessment aggregate, and learner state update should be one transaction.

## Risks and non-direct mappings

- Mongo embedded recall evaluations need normalized `recall_evaluations` and `recall_knowledge_point_results` rows.
- Mongo ObjectIds need a durable mapping table during import.
- Existing personal `Skill` and canonical `canonical_skills` are different entities and must not be merged.
- Existing personal `Concept` and canonical `canonical_concepts` are different entities and must not be merged.
- `local-user` has no production identity. Development data must be explicitly reset or assigned to a chosen development account.
- Current PostgreSQL Phase 3 tables use text `user_id`/`goal_id` for early compatibility; the final cutover should use foreign keys to relational `users` and `goals`.
- PostgreSQL is unavailable in the current environment because Docker is not installed. Integration validation is therefore blocked and must not be represented as passing.

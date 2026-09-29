# Phase 3 PostgreSQL Migration Plan

## Decision

Phase 3 introduces PostgreSQL with the `pg` pooled query layer in `server/src/db/postgres.ts`. SQL migrations are ordered files in `server/migrations/` and are applied with `npm run db:migrate`. PostgreSQL is the target authority for canonical knowledge, provenance, resources, baseline assessments, and personal canonical learner state. `pgvector` is intentionally absent.

## Current Mongo collections to target tables

| Mongo collection | PostgreSQL target | Mapping and ownership |
|---|---|---|
| `users` | `users` | `email`, `password_hash`, `name`, timestamps; unique email |
| `goals` | `goals` | `user_id` FK, title, type, target date, weekly budget, status |
| `skills` | `learner_skills` | `user_id`, `goal_id`, mastery and priority; separate from canonical skills |
| `plans` | `plans` | `user_id`, `goal_id`, date window, status |
| `plantasks` | `plan_tasks` | relational task references, status, source, reason, schedule |
| `studysessions` | `study_sessions` | `user_id`, lifecycle fields, source metadata |
| `concepts` | `personal_concepts` | `user_id`, study session, mastery; separate from `canonical_concepts` |
| `recallattempts` | `recall_attempts` and `recall_evaluations` | one attempt row plus normalized evaluation/knowledge-point results |
| `reviewstates` | `review_states` | unique `(user_id, concept_id)`; authoritative timing |
| `learningevents` | `learning_events` | append-only user-owned audit rows |

The Phase 3 migration schema additionally creates `knowledge_domains`, `roles`, `canonical_skills`, `topics`, `canonical_concepts`, `knowledge_points`, `concept_prerequisites`, `knowledge_sources`, `concept_sources`, `role_skills`, `resources`, `resource_coverage`, `baseline_assessments`, `baseline_questions`, and `learner_knowledge_states`.

## Constraints and indexes

- User-owned rows carry `user_id`; services derive it from JWT context and never accept it from request bodies.
- Canonical knowledge uses foreign keys and cascading deletes only within the canonical domain.
- Baseline state uses bounded enums/check constraints for level, source, confidence, mastery, and question difficulty.
- Unique constraints prevent duplicate domain names, role names, skill names within a domain, topic names within a skill, resource URLs, and prerequisite pairs.
- Query indexes cover baseline history, concept/topic lookup, and resource coverage by concept.

## Migration risks

- Existing Mongo ObjectIds are strings and must be mapped to UUIDs with an explicit ID map during the cutover; they must not be cast blindly.
- Embedded recall evaluations need normalized child rows or JSONB with a defined version, not opaque document copying.
- Personal `Skill` and canonical `canonical_skills` must remain separate tables even when their names match.
- Historical `local-user` rows need an ownership reconciliation step before production cutover.
- A final cutover must stop the Mongo process, run an idempotent import, validate row counts and foreign keys, switch `DATABASE_URL`, and remove Mongoose/runtime Mongo dependencies. No dual-write period is permitted.

## Operational sequence

1. Start PostgreSQL with `docker compose up -d postgres`.
2. Run `npm run db:migrate -w server` to create and seed the canonical domain.
3. Build a one-time import utility that reads Mongo exports, writes relational tables in dependency order, and records an ID map.
4. Validate ownership, counts, orphan checks, and representative end-to-end flows.
5. Switch the application connection and tests to PostgreSQL.
6. Remove `mongoose`, `mongodb-memory-server`, Mongo Compose configuration, `MONGODB_URI`, and all Mongoose model imports.

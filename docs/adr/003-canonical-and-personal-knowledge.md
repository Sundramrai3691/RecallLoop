# ADR 003: Separate canonical knowledge from learner evidence

- Status: Accepted (retrospective; inferred from schema and services)
- Date: Unknown

## Context

The product models both skills/concepts associated with roles and what a particular learner has studied or demonstrated.

## Decision

Keep the shared catalog (`canonical_skills`, `canonical_concepts`, and related tables) separate from learner-owned goals, skills, personal concepts, attempts, and states. Link baseline evidence to canonical concepts rather than treating catalog mastery as learner state.

## Consequences

Catalog curation can be shared while progress remains user-scoped. Mapping learner concepts to canonical skill names is imperfect in current code and should be documented as such; do not conflate the two models.

## Evidence

`server/migrations/001_phase3.sql`, `003_core_domain.sql`, `server/src/services/knowledge`, `baseline`, and `learner`.

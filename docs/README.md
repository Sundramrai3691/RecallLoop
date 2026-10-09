# RecallLoop documentation

This index separates current implementation references from domain explanations, migration history, and audit reports. Source code and SQL migrations remain authoritative when a document and implementation disagree. Audit and phase reports are historical snapshots unless they explicitly say otherwise; use Project Status for current verification.

## Current implementation references

- [Architecture](ARCHITECTURE.md): runtime boundaries, domain loop, persistence, and startup.
- [Request and function flows](FLOW.md): route-to-controller-to-service-to-storage map and important workflows.
- [Data model](DATA_MODEL.md): PostgreSQL ownership, table groups, relationships, and transaction boundaries.
- [Decision index](DECISIONS.md): durable architectural decisions and retrospective ADRs.
- [Project status](PROJECT_STATUS.md): evidence-based implementation and verification status.
- [Session log](SESSION_LOG.md): append-only record of repository work sessions.
- [Frontend design](FRONTEND_DESIGN.md): UI system and interaction patterns.

## Product and domain references

- [Adaptive learning](ADAPTIVE_LEARNING.md): selector, learner model, scheduler, planner, and recommendations.
- [Learning model](LEARNING_MODEL.md): learner evidence, mastery, and review behavior.
- [Knowledge model](KNOWLEDGE_MODEL.md): canonical knowledge and its provenance.
- [Question engine](QUESTION_ENGINE.md): questions, assessment sessions, hints, and evaluation.
- [Grounded remediation](GROUNDED_REMEDIATION.md): source ingestion, retrieval, remediation, and verification.

## Audits and migration history

- [Project audit](PROJECT_AUDIT.md)
- [Implementation report](IMPLEMENTATION_REPORT.md)
- [PostgreSQL runtime migration status](POSTGRES_RUNTIME_MIGRATION_STATUS.md)
- [PostgreSQL cutover report](POSTGRES_CUTOVER_REPORT.md)
- [PostgreSQL cutover audit](POSTGRES_CUTOVER_AUDIT.md)
- [Phase 3 migration plan](PHASE3_MIGRATION_PLAN.md)

Migration SQL is in [`server/migrations`](../server/migrations/). The root [README](../README.md) contains setup and common commands.

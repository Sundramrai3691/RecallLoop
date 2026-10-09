# ADR 001: PostgreSQL runtime

- Status: Accepted (retrospective; inferred from implementation and migrations)
- Date: Unknown

## Context

The system needs durable user, learning, planning, canonical knowledge, and assessment data with relational ownership and atomic updates.

## Decision

Use one PostgreSQL database via the Node `pg` pool. Schema changes are represented by ordered SQL migrations. API startup probes that database before listening.

## Consequences

Local API startup requires PostgreSQL to be reachable and migrations must be applied separately. Transactions protect multi-row learning updates. The repository has no MongoDB runtime or second database in the current server path; legacy ID/import code remains migration compatibility.

## Evidence

`server/src/db/postgres.ts`, `server/src/db/connect.ts`, `server/src/index.ts`, `server/migrations/*.sql`, and `docs/POSTGRES_RUNTIME_MIGRATION_STATUS.md`.

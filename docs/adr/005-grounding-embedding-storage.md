# ADR 005: Grounding embedding storage without pgvector

- Status: Accepted for the initial implementation (retrospective; original decision date unknown)
- Decision date: Unknown

## Context

Grounded remediation needs persisted embeddings and repeatable retrieval in the existing PostgreSQL runtime. The configured PostgreSQL instance did not expose the `vector` extension when the implementation was added. A missing optional extension must not block local development or deterministic tests.

## Decision

Persist provider vectors as PostgreSQL `real[]`, with model identity and dimension recorded per chunk. Retrieve a bounded per-user candidate set, then rank it in application code using cosine similarity and deterministic token overlap. Keep embedding behind `EmbeddingProvider`, so a configured production provider can be selected without coupling it to retrieval or persistence.

## Consequences

This keeps the initial schema portable across the configured PostgreSQL environment and makes local retrieval testable without credentials. It does not provide a database vector index; candidate loading and ranking are bounded in application code. If pgvector becomes available and scale warrants it, the repository and migration can change while preserving the provider boundary and provenance model.

## Evidence

`server/migrations/010_grounded_remediation.sql`, `server/src/services/grounding/embeddingProvider.ts`, `server/src/services/grounding/groundedRemediationService.ts`, and `server/src/repositories/groundingRepository.ts`.

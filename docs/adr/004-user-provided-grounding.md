# ADR 004: Ground remediation in user-provided sources

- Status: Accepted (retrospective; inferred from implementation)
- Date: Unknown

## Context

Targeted remediation needs evidence relevant to the learner's missed knowledge point without becoming an unrestricted crawler or a separate learner-state system.

## Decision

Ingest text explicitly submitted by the user, store owner-scoped chunks and embeddings, retrieve only that user's relevant chunks, and persist provenance with generated remediation. The supplied reference is metadata; ingestion does not fetch it.

## Consequences

Grounding is bounded by sources the learner provides and relevance thresholds. Local mock embedding/generation paths support development. Unsupported claims must be rejected or marked; provenance remains available for inspection.

## Evidence

`server/migrations/010_grounded_remediation.sql`, `server/src/services/grounding`, `server/src/repositories/groundingRepository.ts`, and `docs/GROUNDED_REMEDIATION.md`.

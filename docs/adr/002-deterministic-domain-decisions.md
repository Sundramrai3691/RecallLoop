# ADR 002: Deterministic domain decisions

- Status: Accepted (retrospective; inferred from implementation)
- Date: Unknown

## Context

RecallLoop needs repeatable question selection, review timing, planning, and recommendation behavior, while optionally using a language model for extraction and free-form evaluation.

## Decision

Keep scheduling and planning rules in deterministic domain services. Treat model output as a candidate: validate its schema and derive coverage from normalized knowledge-point results before updating learner state. Preserve a deterministic mock provider for local use.

## Consequences

Core timing and task selection do not require vendor access and can be unit tested. Product heuristics are transparent but should not be described as scientifically calibrated. External model failures can interrupt generation/evaluation but cannot directly write unvalidated learner state.

## Evidence

`server/src/services/scheduler`, `server/src/services/goal`, `server/src/services/question`, and `server/src/services/evaluator`.

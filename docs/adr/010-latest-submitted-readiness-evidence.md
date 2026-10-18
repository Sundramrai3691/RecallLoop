# ADR 010: Latest submitted evidence for My Readiness

## Status

Accepted and implemented.

## Context

Goal readiness needs an auditable view of demonstrated knowledge. The existing learner point state is a useful adaptive projection, but it blends repeated outcomes and can aggregate multiple personal concepts. Treating its mastery and `updated_at` as the latest submitted answer can therefore obscure whether the newest answer was correct, partial, wrong, or blank.

## Decision

- Readiness considers only attempts with `submitted_at`, a persisted evaluation, and a result linked to a canonical knowledge-point ID.
- Select one result for each canonical point by `submitted_at DESC`, attempt `created_at DESC`, attempt UUID DESC, then result UUID DESC. This makes equal timestamps deterministic. UUID ordering is only a stable final tie-break, not a claim that one answer happened later.
- Display the selected status directly for `correct` and `partial` results. A `missing` result with a nonblank structured part answer, selected MCQ option, or nonblank free answer is `incorrect`; with no submitted answer it is `unanswered`.
- Count a point with no selected persisted submitted result as unassessed. A pending attempt alone is not evidence.
- Keep the view scoped to exact canonical skill-name mapping and canonical point identities. Do not infer confidence or an aggregate readiness score.
- Leave learner mastery and scheduling projections unchanged; this view does not rewrite historical evidence or schema.

## Consequences

The page reflects the latest submitted result per canonical point and preserves partial, incorrect, unanswered, and absent evidence as separate counts. A learner can see a later wrong result even if older attempts raised blended mastery. This favors recency and direct traceability over a cumulative estimate; it does not claim that one response establishes durable mastery.

## Verification limits

The PostgreSQL regression validates query selection and classification with controlled persisted rows. The offline assessment benchmark uses scripted provider outputs to test parsing, status alignment, bounded invalid-output rejection, structured unanswered behavior, and prompt framing. It does not measure real model grading accuracy or prompt-injection resistance. MCQ grading remains deterministic in application code.

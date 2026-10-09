# ADR 005: Preserve independent evidence for structured question parts

- Status: Accepted
- Date: 2026-10-10

## Context

A single answer to a compound question can hide which requested idea the learner did or did not explain. A single concept-level aggregate is useful for scheduling and display, but cannot represent this distinction by itself.

## Decision

Allow selected multi-point explanatory questions to expose stable part IDs and per-part prompts/rubrics. Reuse the recall submission and evaluator path, evaluating each nonempty part against only its associated existing knowledge-point labels. Store answers on the attempt and part attribution on point results. Update a separate learner state for each `(user, personal concept, point)` inside the existing recall transaction. Keep the aggregate coverage/mastery path for existing summaries and scheduling. MCQ grading remains deterministic.

## Consequences

Clients can show separate answer fields while legacy questions keep the single-answer contract. A blank part is explicit missing evidence and does not receive positive learner state. Part labels currently associate to the personal concept's existing text-based `required_knowledge_points`; this change does not claim a canonical UUID relationship that the current personal-concept schema does not have. Provider failures happen before persistence, while persistence failures roll back the attempt and all evidence together.

## Evidence

`server/migrations/011_structured_question_parts.sql`, `server/src/services/question/questionService.ts`, `server/src/services/recall/recallService.ts`, and `server/src/repositories/legacyPostgresRepositories.ts`.

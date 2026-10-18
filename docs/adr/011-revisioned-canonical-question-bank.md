# ADR 011: Revisioned canonical question bank

## Status

Accepted in implementation, 2026-10-18. This record describes the implemented design; it does not claim the original team discussed it.

## Context

The existing assessment engine persisted questions as learner-specific artifacts and generated most questions from deterministic templates. The curated MCQ file had no stable question identity, canonical UUID mapping, or revision history. A curated shared bank needs canonical grounding while preserving old attempts and retaining the existing evaluator and evidence path.

## Decision

- Store curated identity, immutable revisions, and canonical point mappings separately from learner snapshots and attempts.
- Keep question-level cognitive level separate from 1–5 difficulty.
- Require a current published revision with valid quality state and an explicit engineering or subject-matter review state for normal selection.
- Snapshot selected content into the existing `questions` relation and retain the exact revision FK on the attempt.
- If a concept has bank rows but a required blueprint type has no eligible revision, return an explicit insufficient-coverage conflict before assessment persistence. Keep the existing generator only for concepts with no canonical bank rows.
- Reuse deterministic MCQ grading, the existing free-response evaluator, and the current evidence transaction; the bank itself never changes mastery.

## Consequences

Old learner questions and attempts are not rewritten. Published content is immutable in PostgreSQL, so corrections create a new revision. The separation adds schema and seed maintenance but avoids treating learner artifacts as canonical content. The initial pilot's engineering review is not independent subject-matter approval; the product does not yet provide a reviewer workflow. Topic/type coverage is finite and can produce an explicit 409 until more curated items are approved.

## Verification boundary

Automated fixtures validate structural contracts and mocked evaluation shapes. They do not establish pedagogical quality, model accuracy, expert agreement, or prompt-injection resistance. Those require human review and labeled answers.

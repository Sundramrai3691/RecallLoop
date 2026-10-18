# ADR 012: Auditable question review and benchmark labels

## Status

Accepted as implemented on 2026-10-18. This is a retrospective record of repository behavior; no original decision discussion or owner is inferred.

## Context

The original canonical HTTP pilot carried an `engineering_reviewed` state and was published, but there were no independent subject-matter review records. The assessment selector accepted that engineering state, so the label alone was insufficient evidence for learner-facing use. The evaluator benchmark also contained proposed fixtures but no independently adjudicated human labels.

## Decision

- Learner selection requires current, valid, published content with `subject_matter_reviewed` state and a latest approved, hash-matching review event for that exact revision.
- Review events are append-only and record the verified existing app-user identity, reviewer grant, timestamp, decision, criteria, notes, and exact content hash. No public reviewer-admin endpoint is added.
- Current unreviewed pilot content is moved to draft and awaiting subject-matter review. Missing required coverage returns the existing explicit 409 before learner assessment writes; it does not fall back to generated questions for concepts that have canonical bank entries.
- Engineering-proposed benchmark judgments stay separate from human annotations. Adjudication requires at least two distinct prior reviewers who disagree and an independent adjudicator. Agreement and model accuracy are not claimed from proposals.

## Consequences

Until there is sufficient approved coverage, learners linked to the HTTP canonical bank cannot create those bank assessments. Concepts without bank entries retain the existing deterministic generator. A direct database operator must grant reviewers, and reviewers use the authenticated CLI packet workflow. Dataset reports measure coverage and exact agreement only; a larger, independently labeled set and explicit release thresholds remain future work.

## Evidence

Migration `017_question_bank_review_and_approval.sql`, `questionBankService.ts`, `questionBankWorkflow.ts`, the `httpHumanBenchmark.json` dataset, [review workflow](../QUESTION_BANK_REVIEW.md), and the integration/unit checks document the implemented boundary. Current source inspection found 24 current HTTP questions, 35 total revisions, zero subject-matter review records, and zero human benchmark annotations at implementation time.

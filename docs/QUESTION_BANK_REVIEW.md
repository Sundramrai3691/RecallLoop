# Canonical question review and human benchmark workflow

## Current state

The 24 HTTP pilot questions are engineering audited, but no subject matter approvals or human answer labels are recorded. Migration `017` moves current pilot revisions to `awaiting_subject_matter_review` / `draft`. The normal learner assessment selector requires the latest approved review for the exact current revision and a matching content hash. Until enough question types are approved, HTTP assessments return `409 QUESTION_BANK_COVERAGE_INSUFFICIENT` before creating an assessment or recall attempt. Concepts with no canonical bank rows retain the existing deterministic generated-question path.

The checked-in inventory at [`question-bank/http-pilot-review-inventory.json`](question-bank/http-pilot-review-inventory.json) is an engineering audit, not reviewer approval. Suspected issues are prompts for human inspection, not confirmed defects. RFC citations identify grounding sources; source notes do not certify licensing or permission for a particular use.

## Reviewer authorization and exact-revision review

There is no public reviewer-administration endpoint. An authorized database operator grants an existing verified application user access after independently confirming their reviewer role:

```sql
INSERT INTO canonical_question_reviewers (reviewer_user_id, granted_by_user_id, grant_note)
VALUES ('<existing reviewer app_users UUID>', '<existing grantor app_users UUID>', '<reason for authorization>');
```

The grant is auditable and revocable. Do not create an account or reviewer identity for convenience. The reviewer uses their ordinary authenticated bearer token through the `RECALLLOOP_REVIEWER_TOKEN` environment variable; do not put the token in a packet, command line, shell history, or tracked file.

Export a review packet with `npm run question-bank:review:export -w server -- --out <private-path>`. Review the exact revision UUID, revision number, and content hash in each entry. Fill in the decision, explanatory notes (at least 20 characters), and all nine criteria: technical correctness, expected answer, explanation, MCQ key, distractors, rubric, canonical point mapping, cognitive level/difficulty, and source attribution/license. Mark only genuinely inapplicable dimensions `not_applicable`; applicability rules depend on question type. Approval requires every applicable criterion to pass. Import with `npm run question-bank:review:import -w server -- --in <completed-private-packet>`. The importer verifies the authenticated account's active grant, binds reviewer identity from the verified token and timestamp from PostgreSQL, rejects stale revisions/hashes, and appends an immutable review record. A later non-approval decision revokes eligibility until a newer approval is recorded.

Grant/revoke changes require database access. Review records cannot be edited or deleted through the application. Content changes require a new immutable question revision and a new review; approval is never inherited across revisions.

## Inventory

Run `npm run question-bank:audit -w server` after migrations and seed. It writes the database-grounded inventory in this directory with question/revision IDs, hashes, exact point UUID mapping, answer and rubric metadata, provenance fields, automated validation results, and review state. A nonzero validation issue count requires investigation before review. The report does not approve content.

## Human answer benchmark

`server/src/services/questionBank/httpHumanBenchmark.json` contains 10 submitted-answer cases with exact question revision hashes, canonical point, rubric dimensions, and an engineering-proposed outcome/rationale. Proposed judgments are hypotheses, not human labels. `npm run question-bank:benchmark -w server` reports case/point/outcome/answer-kind coverage and annotation states. It explicitly reports model accuracy as `not_measured`; proposal agreement remains blocked until valid adjudications exist.

An authorized reviewer exports a blinded packet with `npm run question-bank:benchmark:export -w server -- --out <private-path>`. The exported packet omits proposed labels/rationales. Reviewers enter rubric-level and overall judgments with rationale; imports bind the reviewer from their authenticated token and a timestamp from the local clock. Two distinct labels are required before an independent third reviewer can adjudicate a disagreement. Agreement among the two labels is reported separately; adjudication resolves disagreement but does not make the engineering proposal ground truth. Imports verify the exact revision and case before updating the machine-readable dataset. Do not record learner-identifying information in benchmark answers.

The report is descriptive coverage and exact agreement, not a psychometric reliability estimate or a production evaluator score. Do not publish accuracy or quality claims from proposed labels. Expand the set and define release thresholds only after independent labels, adjudications, and error review exist.

# Automated question review, optional human review, and benchmark workflow

## Current state

Automated quality review is the normal path for question-bank approval. Migration `020` stores append-only automated decisions separately from human reviews; learner eligibility accepts a current, quality-valid, published revision with an exact-hash automated approval or a valid exact-hash human approval. Automated review is never represented as a human decision. Human review remains available as an additional mechanism and is not required for every question.

The configured local `recallloop` database was inspected on 2026-10-27. It contains 161 total canonical revisions and 150 current revisions; 138 current revisions have automated approval and are published, while 12 current HTTP revisions are in the separate subject-matter-review/draft-or-retired track. The current report records zero human approvals and zero engineering issues. Assessment coverage is available for HTTP caching and HTTP request lifecycle in all four modes; TCP reliable byte streams in Rapid Fire; two DBMS concepts, two DSA concepts, two OS concepts, and five System Design concepts in Rapid Fire. Backend Engineering has no eligible canonical assessment, and four DBMS topics lack a complete blueprint. See the regenerated [Core SDE domain coverage report](question-bank/core-sde-domain-coverage-report.json).

Run the reproducible automated preflight against a verified local target with `npm run question-bank:automated-review -w server`; it produces a machine-readable manifest. Verify the configured database and scope before applying decisions with `npm run question-bank:automated-review -w server -- --apply`. The workflow operates on current, non-retired revisions, validates exact authored content and deterministic quality rules, and records the automated reviewer type, policy version, method, revision/hash, structured decision/findings, source-verification state, run ID, and timestamp. It does not create reviewer grants, human decisions, or invented source verification.

Assessment creation rechecks complete mode coverage and rejects insufficient requests with `409 QUESTION_BANK_COVERAGE_INSUFFICIENT` before creating learner records. Concepts without canonical bank rows retain the existing deterministic generated-question path. For bulk operations, verify the database identity and declared scope before using `--apply`; do not run against production or an unknown database.

The checked-in inventory at [`question-bank/http-pilot-review-inventory.json`](question-bank/http-pilot-review-inventory.json) is an engineering audit, not reviewer approval. Suspected issues are prompts for human inspection, not confirmed defects. RFC citations identify grounding sources; source notes do not certify licensing or permission for a particular use.

## Smallest HTTP assessment review set

The [HTTP Rapid Fire reviewer packet](question-bank/http-rapid-fire-review-packet.json) is a historical, exact-revision human-review export narrowed to the two HTTP-caching MCQ revisions and three rapid-recall revisions needed for one Rapid Fire round, plus a distinct verification candidate. Its blank human criteria do not override or block a valid automated decision. Treat packet decisions as applicable only to the exact content hash included; use automated coverage and the current database report to determine actual learner eligibility.

The machine-readable [activation report](question-bank/http-rapid-fire-activation-report.json) is database-specific. Regenerate it against the verified target before using its counts; it is a report, not an approval artifact.

## Reviewer authorization and exact-revision review

There is no public reviewer-administration endpoint. An authorized database operator grants an existing verified application user access after independently confirming their reviewer role:

```sql
INSERT INTO canonical_question_reviewers (reviewer_user_id, granted_by_user_id, grant_note)
VALUES ('<existing reviewer app_users UUID>', '<existing grantor app_users UUID>', '<reason for authorization>');
```

The grant is auditable and revocable. Do not create an account or reviewer identity for convenience. The reviewer uses their ordinary authenticated bearer token through the `RECALLLOOP_REVIEWER_TOKEN` environment variable; do not put the token in a packet, command line, shell history, or tracked file.

Export a review packet with `npm run question-bank:review:export -w server -- --out <private-path>`. Review the exact revision UUID, revision number, and content hash in each entry. Fill in the decision, explanatory notes (at least 20 characters), and all nine criteria: technical correctness, expected answer, explanation, MCQ key, distractors, rubric, canonical point mapping, cognitive level/difficulty, and source attribution/license. Mark only genuinely inapplicable dimensions `not_applicable`; applicability rules depend on question type. Approval requires every applicable criterion to pass. Import with `npm run question-bank:review:import -w server -- --in <completed-private-packet>`. The importer verifies the authenticated account's active grant, binds reviewer identity from the verified token and timestamp from PostgreSQL, rejects stale revisions/hashes, and appends an immutable review record. A later non-approval decision revokes eligibility until a newer approval is recorded.

Before import, validate completeness and exact current database content without writes:

```powershell
npm run question-bank:review:validate -w server -- --in <completed-private-packet>
```

The validator reports each incomplete entry and field, verifies the full packet content against its current revision/hash, and rejects duplicate revision entries. Import rechecks the packet transactionally. Repeating an identical import by the same reviewer is idempotent (reported as repeated); a different decision, criteria, or note for a revision already submitted by that reviewer is rejected. A different reviewer may independently add a decision, and the latest review still controls eligibility. This preserves review history without turning a changed packet into a second silent approval.

Check current eligibility and the exact Rapid Fire blueprint with:

```powershell
npm run question-bank:activation-report -w server -- --out ..\docs\question-bank\http-rapid-fire-activation-report.json
```

The report lists engineering validation, human review, publication, and assessment eligibility separately. It queries the same eligible-question selector used by the assessment engine and reports whether the sixth revision can support a new point-targeted verification after Rapid Fire.

After a reviewer completes the packet, the single post-review procedure is:

```powershell
# Set RECALLLOOP_REVIEWER_TOKEN from a secure local secret source before running this.
npm run question-bank:activate -- --in <completed-private-packet>
npm run question-bank:activate -- --in <completed-private-packet> --apply
```

The first command is a no-write preflight. The second explicitly imports the authenticated decisions into the configured application database, recomputes the actual coverage report, stops if the exact 2+3 blueprint or the distinct approved verification question is unavailable, and then runs the disposable PostgreSQL integration and browser suites. It does not approve or publish anything on its own. `RECALLLOOP_REVIEWER_TOKEN` must be set from a secure local secret source; never paste its value into shell history, a packet, or tracked files. A genuine non-approval is imported as such and will stop activation with the missing coverage reasons.

The isolated assessment-to-improvement regression can also be run independently with `npm run test:assessment-loop`. It refuses non-loopback PostgreSQL hosts, creates a randomly named disposable database, migrates and seeds it, verifies the insufficient-coverage zero-write gate, adds explicit test-only review fixtures only inside that database, runs PostgreSQL integration and Firefox/Playwright E2E with mock providers, and drops the disposable database in `finally`. The fixtures are not human approvals and are never written to the configured application database or seed files. A database role with local `CREATEDB` permission is required.

Grant/revoke changes require database access. Review records cannot be edited or deleted through the application. Content changes require a new immutable question revision and a new review; approval is never inherited across revisions.

## Inventory

Run `npm run question-bank:audit -w server` after migrations and seed. It writes the database-grounded inventory in this directory with question/revision IDs, hashes, exact point UUID mapping, answer and rubric metadata, provenance fields, automated validation results, and review state. A nonzero validation issue count requires investigation before review. The report does not approve content.

## Human answer benchmark

`server/src/services/questionBank/httpHumanBenchmark.json` contains 10 submitted-answer cases with exact question revision hashes, canonical point, rubric dimensions, and an engineering-proposed outcome/rationale. Proposed judgments are hypotheses, not human labels. `npm run question-bank:benchmark -w server` reports case/point/outcome/answer-kind coverage and annotation states. It explicitly reports model accuracy as `not_measured`; proposal agreement remains blocked until valid adjudications exist.

An authorized reviewer exports a blinded packet with `npm run question-bank:benchmark:export -w server -- --out <private-path>`. The exported packet omits proposed labels/rationales. Reviewers enter rubric-level and overall judgments with rationale; imports bind the reviewer from their authenticated token and a timestamp from the local clock. Two distinct labels are required before an independent third reviewer can adjudicate a disagreement. Agreement among the two labels is reported separately; adjudication resolves disagreement but does not make the engineering proposal ground truth. Imports verify the exact revision and case before updating the machine-readable dataset. Do not record learner-identifying information in benchmark answers.

The report is descriptive coverage and exact agreement, not a psychometric reliability estimate or a production evaluator score. Do not publish accuracy or quality claims from proposed labels. Expand the set and define release thresholds only after independent labels, adjudications, and error review exist.

## Core SDE review packets

Phase U3 adds five separately exportable optional human-review packets for Data Structures and Algorithms, Operating Systems, Database Management Systems, Computer Networks, and System Design. Export uses the active canonical catalog and current database revisions, checks the authored content hash and exact canonical-point mapping, and includes automated audit findings with each entry. Retired revisions are omitted from domain packets. The packet does not grant reviewer access or approve, publish, or activate a question; a valid automated decision remains the normal path for assessment eligibility.

Export a human-review packet after migrations and seed with `npm run question-bank:review:export-domain -w server -- --domain "<canonical domain>" --out <private-path>`. Validate completed packets with `npm run question-bank:review:validate -w server` and import only through the authorized human-review workflow. The 114 Core SDE authored candidates are processed by the automated review workflow; only currently valid and published exact revisions are eligible. The twelve early duplicate HTTP candidates remain retired history. The checked-in coverage JSON is a database snapshot; regenerate it against the intended database before relying on its counts.

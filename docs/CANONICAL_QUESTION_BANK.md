# Canonical question bank v1

## Scope and observed starting point

This first pilot uses the existing `HTTP` topic because it contains two distinct active canonical concepts and their canonical point IDs can be resolved directly. A read-only inventory on 2026-10-18 found 9 canonical knowledge points across the database, of which 2 belong to HTTP. Before this change, the checked-in `mcqBank.ts` had 10 matcher/build branches and 14 possible MCQ variants; those variants had no stable canonical question UUIDs or revision/provenance rows. The database had 25 question rows, all attached to learner-specific concepts (descriptive 4, MCQ 4, rapid recall 14, scenario 1, short explanation 1, transfer 1). None was stored as a curated question mapped to the current canonical HTTP concept/point rows. Those are different inventories and are not combined as if the learner artifacts were canonical bank content.

The pilot adds 24 original questions: 12 for `HTTP caching` / “Can distinguish freshness from validation.” and 12 for `HTTP request lifecycle` / “Can explain method, status, headers, and body roles.” Items are grounded by reference-only citations to IETF [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html) and [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html); no RFC prose or external question collection is reproduced. Citation provenance records title, URL, publisher, source/permission note, access date, and grounding sections.

## Data and revision lifecycle

`canonical_question_items` holds stable slug, canonical concept identity, and current revision. `canonical_question_revisions` holds immutable content and its type, independent cognitive level and difficulty, expected answer, rubric, misconception metadata, MCQ key/options/rationales, hints, provenance, quality/review/publication states, and content hash. `canonical_question_revision_points` maps a revision to one or more existing canonical knowledge points, with a trigger enforcing that each point belongs to the item's concept.

Migration `016` adds nullable exact-revision foreign keys to the existing learner-scoped `questions` snapshots and `recall_attempts`, plus snapshot rubric storage. Migration `017` adds reviewer grants and append-only review events tied to an immutable revision UUID and content hash. It demotes the unapproved pilot from learner publication and requires the latest review record to be an authorized approval before a revision can be marked subject-matter reviewed or published. Existing learner records are not rewritten. Published revision content cannot be updated or deleted in PostgreSQL; content changes require a new revision. Assessment setup snapshots the selected content into `questions` and carries that same revision ID through the attempt, so later publication of a newer revision cannot change the old attempt's prompt or rubric.

Migration `020` adds a separate append-only automated-review record keyed to the exact current revision, content hash, policy version, method, decision, structured findings, source-verification state, run ID, and timestamp. Automated approval is not recorded as human approval. A current revision may be published through either a valid exact-revision human approval or a valid automated approval; human review is an optional additional mechanism, not the normal prerequisite for assessment use.

The seed resolves each pilot mapping by exact normalized canonical concept name and point statement, requires exactly one active pair, and inserts idempotently. Same slug/revision with changed content hash fails and requires a new revision. No canonical knowledge rows are created or duplicated.

## Taxonomy and measured pilot distribution

The pilot maps the application's six supported `assessment_level` values onto five useful thinking bands: recognition + recall, explanation, application, depth (analysis/debugging), and transfer. The schema stores cognitive level independently from difficulty 1–5.

| Dimension | Pilot counts |
|---|---|
| Thinking band | Recognition/recall 8; explanation 4; application 4; analysis/debugging (`depth`) 4; transfer 4 |
| Stored cognitive value | recognition 2; recall 6; explanation 4; application 4; depth 4; transfer 4 |
| Difficulty | 1: 4; 2: 6; 3: 4; 4: 6; 5: 4 |
| Question type | MCQ 10; rapid recall 6; short explanation 2; scenario 2; descriptive 2; transfer 2 |
| Canonical point | 12 items each |

Every item has an objective and defensible expected answer. MCQs have four distinct options, one deterministic key, answer explanation, and a misconception rationale for every distractor. Free response items have full, partial, and insufficient rubric criteria. The offline gate checks supported taxonomy, canonical pair, mapping terminology relevance, rubric shape, MCQ contract, provenance, revision identity, prompt duplication/near duplication, level/type/difficulty/point coverage, and benchmark references.

Six labeled fixtures cover correct, partial, misconception, vague, incorrect, and instruction-override-shaped attempts with expected status and rubric dimensions. These validate data and evaluation contracts; they do not measure an LLM's accuracy, inter-rater agreement, or resistance to prompt injection.

## Assessment selection and evidence boundary

When a learner's personal concept links to a canonical concept that has bank entries, assessment creation selects only exact current revisions that are quality-valid, published, and have either a matching valid automated approval or a matching authorized human approval. The selector checks the exact content hash and applies the existing fixed blueprint; it favors revisions not recently presented, balances canonical point use, then considers target difficulty and stable slug. Selection is deterministic. If a banked concept lacks an eligible item for a required type, the API reports HTTP 409 `QUESTION_BANK_COVERAGE_INSUFFICIENT` before creating assessment or attempt records; it does not silently use generated questions. Concepts with no bank entries keep the pre-existing deterministic generator.

The database-grounded [Core SDE domain coverage report](question-bank/core-sde-domain-coverage-report.json), regenerated on 2026-10-27 from the configured local `recallloop` database, records 161 total revisions and 150 current revisions. Of the current set, 138 are published with automated review and 12 HTTP revisions remain in the subject-matter-review/draft-or-retired track; no human approvals are recorded. The automated set has zero reported engineering issues. Assessment coverage is genuinely available for HTTP caching and HTTP request lifecycle in all four assessment modes, TCP reliable byte streams in Rapid Fire, two DBMS concepts in Rapid Fire, two DSA concepts in Rapid Fire, two OS concepts in Rapid Fire, and five System Design concepts in Rapid Fire. Backend Engineering has no eligible canonical assessment, and four DBMS topic clusters lack a complete blueprint. The report lists candidate counts separately from the modes that meet complete eligibility rules.

Automated review is the normal approval path and is not a claim of independent expert or source verification. Current unverified source content remains labeled unverified/partial and must not be presented as verified; missing evidence blocks only content for which it is essential to defend assessment use. Human review remains available through the [review workflow](QUESTION_BANK_REVIEW.md), but neither human reviewer accounts nor manual approval are prerequisites for routine question-bank operation.

`npm run test:assessment-loop` verifies the insufficient-coverage gate before isolated test-only approval fixtures, then exercises HTTP Rapid Fire, targeted remediation, a distinct verification question, persisted evidence, and readiness in a disposable PostgreSQL database. Test approvals are confined to that database and do not alter normal eligibility or constitute human review.

Selected questions become ordinary personal-concept snapshots and `recall_attempts`. MCQs continue through deterministic `evaluateMcq`; free responses continue through the existing structured evaluator using the stored rubric. Submitted results flow through the existing transactional evaluation and canonical point-evidence path. The bank does not declare mastery. Tests exercise canonical revision IDs, mappings, grading, rubric use, published immutability, and historical snapshot interpretation.

## Next quality milestone

The machine-readable answer benchmark currently contains ten proposed cases with no human annotations or adjudications. Reported proposal agreement and model accuracy are blocked/not measured until independent labels and adjudication exist. Human content review can add independent quality evidence but is optional for routine assessment eligibility; benchmark labels remain necessary before making evaluator-accuracy claims. Continue automated regression checks for immutable revisions, quality-policy reevaluation, and assessment eligibility; expand the bank only where useful, defensible coverage is missing.

## Phase U3: Core SDE coverage expansion (2026-10-20)

Migration `018_core_sde_taxonomy.sql` adds the canonical domains Data Structures and Algorithms, Operating Systems, Database Management Systems, and Computer Networks; it reuses System Design and existing database and HTTP catalog identities where possible. Migration `019_retire_duplicate_http_core_candidates.sql` preserves twelve early duplicate HTTP candidate revisions as retired history. Existing HTTP questions and the official HTTP review packet are not edited.

The authored Core SDE set contains 114 new candidates across 19 canonical points: two MCQs, three rapid-recall items, and one distinct short-explanation item per point. The seed validates and maps each question to the existing canonical point. A database-backed automated review workflow evaluates current revisions and records distinct, traceable automated decisions; passing exact revisions may be published without human approval. The current [Core SDE domain coverage report](question-bank/core-sde-domain-coverage-report.json) is database-grounded; regenerate it with `npm run question-bank:coverage` against the intended database before relying on its counts.

The coverage selector groups by canonical domain and exposes current, pending-review, eligible counts, status, and modes actually supported by the existing selector. It displays mapped point statements for concept selection; it does not yet provide separate within-concept point selection. Domain-specific review packets are produced with `npm run question-bank:review:export-domain -w server -- --domain "<canonical domain>" --out <private-path>`. The packet must be generated against the live migrated database to bind immutable revision IDs, hashes, and mappings. Existing HTTP review state remains a separate workflow.

# Canonical question bank v1

## Scope and observed starting point

This first pilot uses the existing `HTTP` topic because it contains two distinct active canonical concepts and their canonical point IDs can be resolved directly. A read-only inventory on 2026-10-18 found 9 canonical knowledge points across the database, of which 2 belong to HTTP. Before this change, the checked-in `mcqBank.ts` had 10 matcher/build branches and 14 possible MCQ variants; those variants had no stable canonical question UUIDs or revision/provenance rows. The database had 25 question rows, all attached to learner-specific concepts (descriptive 4, MCQ 4, rapid recall 14, scenario 1, short explanation 1, transfer 1). None was stored as a curated question mapped to the current canonical HTTP concept/point rows. Those are different inventories and are not combined as if the learner artifacts were canonical bank content.

The pilot adds 24 original questions: 12 for `HTTP caching` / “Can distinguish freshness from validation.” and 12 for `HTTP request lifecycle` / “Can explain method, status, headers, and body roles.” Items are grounded by reference-only citations to IETF [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html) and [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html); no RFC prose or external question collection is reproduced. Citation provenance records title, URL, publisher, source/permission note, access date, and grounding sections.

## Data and revision lifecycle

`canonical_question_items` holds stable slug, canonical concept identity, and current revision. `canonical_question_revisions` holds immutable content and its type, independent cognitive level and difficulty, expected answer, rubric, misconception metadata, MCQ key/options/rationales, hints, provenance, quality/review/publication states, and content hash. `canonical_question_revision_points` maps a revision to one or more existing canonical knowledge points, with a trigger enforcing that each point belongs to the item's concept.

Migration `016` adds nullable exact-revision foreign keys to the existing learner-scoped `questions` snapshots and `recall_attempts`, plus snapshot rubric storage. It does not rewrite existing learner records. Published revision content cannot be updated or deleted in PostgreSQL; content changes require a new revision. Assessment setup snapshots the selected content into `questions` and carries that same revision ID through the attempt, so later publication of a newer revision cannot change the old attempt's prompt or rubric.

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

When a learner's personal concept links to a canonical concept that has any bank entries, assessment creation selects current revisions only if publication is `published`, quality is `valid`, and review is `engineering_reviewed` or `subject_matter_reviewed`. It follows the existing assessment blueprint's question types, favors revisions not recently presented, balances canonical point use, then considers target difficulty and stable slug. Selection is deterministic. If a banked concept lacks an eligible item for a required type, the existing assessment API reports HTTP 409 `QUESTION_BANK_COVERAGE_INSUFFICIENT`; it creates no assessment/session attempt and does not silently use a generated template. Concepts with no bank entries keep the pre-existing deterministic generator.

The pilot is marked `engineering_reviewed`, not `subject_matter_reviewed`. That gate records checked structure, mappings, source grounding, and engineering contracts; an independent protocol SME has not reviewed this content. Normal learner assessment currently permits the engineering state because there is no separate reviewer workflow in the product. This is a clear review limitation, not an assertion of expert approval.

Selected questions become ordinary personal-concept snapshots and `recall_attempts`. MCQs continue through deterministic `evaluateMcq`; free responses continue through the existing structured evaluator using the stored rubric. Submitted results flow through the existing transactional evaluation and canonical point-evidence path. The bank does not declare mastery. Tests exercise canonical revision IDs, mappings, grading, rubric use, published immutability, and historical snapshot interpretation.

## Next quality milestone

The highest-value next step is independent subject-matter review of the 24 pilot items and rubric/benchmark labels, followed by a small human-labeled answer set with adjudication notes. Only then should the review status advance to subject-matter reviewed. Expand to another canonical topic only after reviewers find the pilot items valid, unambiguous, and useful for diagnosing their mapped point; question count is not the success metric.

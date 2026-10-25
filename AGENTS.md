# RecallLoop Agent Instructions

## 1. Repository boundaries

- This is the RecallLoop npm workspace: `client` is React/Vite and
  `server` is Express/TypeScript with PostgreSQL. Keep API contracts,
  ownership checks, and database migrations consistent across both packages.
- Treat `server/migrations` as the deployed schema history. Use additive
  migrations for schema changes. Do not silently edit historical migrations
  or infer the live database schema from TypeScript types.
- Derive the authenticated owner from the request's verified user identity.
  Never trust a client-supplied `user_id`.
- Keep domain decisions in services, SQL in repositories or established
  service queries, request parsing in controllers, and shared contracts in
  existing types. Follow the current architecture unless a documented
  decision justifies an exception.
- Treat all LLM and external-provider output as untrusted. Validate
  structured output before using it in domain decisions or persisting it.
- Preserve deterministic mock behavior for local development and automated
  tests. Never silently substitute mock results when a configured live
  provider fails.
- Never add credentials, real learner data, authentication tokens, or
  generated secrets to tracked files.
- Preserve existing user modifications. Do not reset, stash, discard,
  overwrite, or commit user work unless explicitly instructed.
- Inspect the actual repository, Git state, database schema, relevant code,
  and tests before making changes. Historical reports are evidence to
  reconcile, not proof that the current workspace is unchanged.

## 2. Core product principles

RecallLoop helps learners identify what they cannot reliably explain or
apply, fix the precise weakness, and verify improvement.

Preserve these four primary learner experiences:

1. Test a Topic:
   Select canonical knowledge, complete a supported assessment, and
   understand the results.

2. Learn from My Material:
   Study supported material, ask grounded follow-up questions, and practise.

3. Review & Improve:
   Access due reviews, identified weaknesses, and targeted practice.

4. My Readiness:
   Inspect goal-relevant skills and the learner evidence supporting
   their current state.

These experiences must reuse the existing canonical knowledge model,
question bank, assessment engine, retrieval, learner model, remediation,
and scheduler wherever possible.

Do not build parallel assessment engines, duplicate learner models,
or unrelated features merely to make a task appear larger.

Prefer a complete, tested user workflow over isolated features, repeated
audits, or cosmetic changes that do not address a demonstrated problem.

Do not repeatedly investigate or reimplement a capability already
confirmed to work. Identify the actual remaining gap, implement it,
and validate the affected behavior.

Make reasonable engineering decisions independently. Do not ask the
product owner to approve routine implementation details, individual
questions, test cases, or reversible engineering decisions.

## 3. Automated-first engineering policy

**All normal development, question review, validation, and release-readiness
checks must use automated workflows wherever the repository supports them.
Manual approval must never be a mandatory dependency for ordinary
development or question-bank activation.**

Agents must implement and execute the relevant automated checks instead
of stopping after producing a plan, audit, report, or review packet.

### 3.1 Required implementation behavior

When a requested capability already exists:
- Verify the current implementation and its relevant tests.
- Identify the actual remaining gap.
- Avoid rebuilding the capability.
- Move to the next substantive incomplete requirement.

When implementation is missing:
- Implement the missing behavior.
- Add or update automated regression tests.
- Execute the relevant tests.
- Fix failures caused by the changes.
- Update documentation.
- Report actual results.

Do not repeatedly rerun unchanged suites without a specific reason.

Do not stop at statements such as "human review is required" when an
automated implementation can safely complete the requested work under
the project's policy.

### 3.2 Automated testing requirements

Use the existing Vitest, PostgreSQL integration, Firefox/Selenium, and
Playwright infrastructure as appropriate.

Automate:
- Unit and service tests.
- API and database integration tests.
- Ownership and authorization tests.
- Transaction and persistence-failure tests.
- Question-quality validation.
- Question-bank review and eligibility checks.
- Assessment submission and report tests.
- Browser journeys and critical UI interactions.
- Responsive viewport and overflow checks.
- Build, type-check, syntax-check, and diff validation where available.

Do not require manual clicking, manual reviewer sign-off, or manual
question-by-question verification to declare a code task complete
when equivalent automated checks can be implemented.

Where a tool supports browser automation and screenshot capture, use it
to verify actual rendered behavior. Do not claim that a browser flow,
viewport, or visual check passed unless the relevant automated test ran.

Live-provider calls are not required for ordinary tests. Use deterministic
fixtures and mocks for provider-dependent behavior. Test live-provider
behavior separately only when explicitly necessary and safely configured.

### 3.3 Honest reporting

Distinguish:
- Implemented.
- Automated-reviewed.
- Tested.
- Browser-validated.
- Measured.
- Human-reviewed, if applicable.
- Assessment-eligible.
- Deployed.
- Production-ready.

Passing automated tests does not establish perfect technical correctness,
real-world model accuracy, educational effectiveness, or durable mastery.

Report what the checks establish and what remains uncertain.

## 4. Canonical question bank and automated review policy

### 4.1 Automated review is the normal approval path

RecallLoop uses automated quality review as the standard path for
making canonical questions assessment-eligible.

**Human subject-matter approval is optional and must not be required
for every question before normal assessment use.**

Do not stop question-bank implementation or activation merely because
there is no human reviewer account, reviewer grant, reviewer token,
or manually completed review packet.

The automated review path must be implemented in the actual database,
services, APIs, scripts, and assessment-selection logic. Updating only
documentation or frontend labels is insufficient.

Human review may remain available as an additional review mechanism,
but it must not be a prerequisite for ordinary question-bank operation.

### 4.2 Automated decisions must be represented honestly

Automated question review must be distinguishable from human review.

Never:
- Create fake human reviewers.
- Fabricate reviewer grants or tokens.
- Insert automated decisions as human approval events.
- Invent human identities, signatures, timestamps, or review notes.
- Claim independent expert approval when only automated checks ran.

Automated approval is a legitimate decision under the product's automated
quality policy. It is not a claim that a human expert approved the question.

### 4.3 Automated review records

Use the existing review and revision schema where possible.

Each automated decision must be traceable to:
- Canonical question identity.
- Exact immutable revision ID and content hash.
- Automated reviewer type or method.
- Review policy and validator version.
- Review-run identifier.
- Decision and structured findings.
- Source-grounding and provenance status.
- Timestamp.

Add an additive migration only if the current schema cannot store these
decisions safely.

Repeated processing of unchanged content under the same policy should
be deterministic and idempotent.

A changed revision or materially changed policy must trigger
reevaluation. A decision for an earlier revision must never authorize
modified content automatically.

Preserve existing human review records and historical assessment attempts.

### 4.4 Automated decisions

Use the existing status model where possible, with semantics equivalent
to the following:

- APPROVED:
  All required automated quality checks pass. The revision may become
  eligible under the automated publication policy.

- REVISE:
  A specific, safely correctable issue exists. Create a new immutable
  revision, preserve the original, and reevaluate the replacement.

- REJECTED:
  The question is materially incorrect, redundant, unsuitable, or
  irreparably ambiguous.

- BLOCKED:
  Essential evidence, a defensible answer, a valid mapping, or a
  required evaluation contract is missing.

A reviewer token or manual approval must not be a prerequisite for
automated decisions.

Do not approve every question merely because it exists or passes a
superficial structural check. Equally, do not leave a question awaiting
human review when the automated quality policy is sufficient to decide it.

Every evaluated current question must receive an actual decision and
actionable findings.

### 4.5 Question-quality checks

Review current question content substantively, not just its metadata.

#### Structural validity

Check:
- Required question content and supported question type.
- Valid canonical knowledge-point mapping.
- Expected answer or evaluation contract.
- Required rubric dimensions and outcome criteria.
- Supported cognitive-level and difficulty values.
- Stable identity and immutable revision consistency.
- Required provenance fields.

#### MCQs

Check:
- The answer key identifies exactly one defensible correct option,
  unless the existing grading contract explicitly permits otherwise.
- Options are valid and not duplicated or equivalent.
- The explanation agrees with the answer key.
- Distractors are plausible but defensibly wrong under the stated
  assumptions.
- Distractor rationales identify meaningful misconceptions.
- The question does not depend on unstated constraints that change
  the correct answer.

MCQ grading must remain deterministic and independent of an LLM.

#### Free-response and scenario questions

Check:
- The expected answer is technically defensible.
- The assessment objective is clear.
- Required reasoning is identified.
- Full, partial, and insufficient answers can be distinguished.
- Rubric dimensions and scoring rules are internally consistent.
- Common misconceptions are handled where appropriate.

#### Technical correctness

Check:
- The question assesses its mapped canonical knowledge point.
- The scenario contains sufficient information.
- The answer and explanation do not contradict one another.
- Cognitive level and difficulty match the actual reasoning required.
- Similar questions are not counted as distinct coverage without a
  meaningful difference in skill, context, or reasoning.
- Verification questions use a different context, representation,
  or constraint where possible.

#### Provenance

Use real source references and verify source content where available.

Distinguish a recorded reference from one whose content was actually
inspected. Do not invent citations, quotations, authors, or licensing
permissions.

Create original questions from technical principles rather than
reproducing proprietary interview collections.

A missing or unverifiable source must be recorded accurately. Follow the
established provenance policy; do not label an unchecked source verified.

### 4.6 Automated source checking and uncertainty

Prefer deterministic checks for structural validity, mapping,
answer-key correctness, revision integrity, and grading contracts.

Use the configured automated review mechanism for substantive semantic
checks where it is available. Validate its structured output.

Do not require a live remote LLM call for ordinary unit or integration
tests.

If external source verification or a live provider is unavailable:
- Complete all checks that can be performed locally.
- Record the limitation explicitly.
- Do not invent source verification or evaluation results.
- Block only questions for which the missing evidence makes assessment
  unsafe or the answer indefensible.
- Continue reviewing all other applicable questions.

Do not use missing external access as an excuse to avoid processing the
entire question bank.

### 4.7 Publication and eligibility

The backend must accept passing automated-review decisions as a
legitimate path to assessment eligibility.

A question is eligible only when:
- Its current immutable revision has a valid automated review decision
  under the current applicable policy, or a valid existing human review.
- All mandatory structural and grading checks pass.
- Required canonical mappings and provenance are valid.
- No unresolved critical correctness issue exists.
- Its publication state permits assessment use.
- Its assessment type and requested scope satisfy existing coverage rules.

Draft, rejected, blocked, retired, stale, or invalid revisions remain
ineligible.

Assessment coverage APIs must count only current revisions that are
genuinely eligible for the requested assessment mode and scope.

Keep candidate counts separate from eligible assessment counts.
Never invent questions or lower coverage thresholds to make a topic
appear available.

If coverage is insufficient, report it explicitly and provide a
supported alternative.

## 5. Bulk question-review workflow

The automated question-review workflow must process applicable current
canonical revisions in bulk without requiring the product owner to
inspect or approve each question individually.

Reuse the existing scripts, validators, schema, and review conventions.

Provide a reproducible command supporting:

1. Read-only inventory and preflight.
2. Bulk review of current, non-retired revisions.
3. Structured decisions and findings.
4. Creation of immutable replacement revisions for safe corrections.
5. Reevaluation of corrected revisions.
6. Persistence of automated-review decisions.
7. Publication and eligibility checks.
8. A machine-readable report and concise summary.

Inspect existing npm scripts before introducing command names.

Verify the configured database target before any write. Never perform
bulk changes against an unknown or production database.

The owner has authorized automated review under this policy. Once the
local database and intended scope are verified, routine and reversible
operations within that scope do not require repeated confirmation.

Do not stop after producing a report, migration, or command. Execute
the authorized workflow when the intended local database is verified.

Preserve original revisions, review history, and historical attempts.
Process only records within the declared scope.

## 6. Assessment and learner-evidence integrity

- Keep question selection, assessment creation, grading, reporting,
  remediation, and verification on the existing domain path.
- Preserve immutable revision references on assessment attempts.
- Do not reveal correct answers or grading explanations before the
  appropriate submission state.
- Enforce ownership using verified authentication.
- Duplicate submissions must not create duplicate learner evidence.
- Failed or invalid evaluation must not create misleading successful
  learner evidence.
- Persist assessment completion and corresponding learner-state updates
  consistently using existing transactions and locking conventions.
- Ordinary tutoring messages and unsubmitted answers must not become
  assessment evidence.
- Material-specific generated questions must not bypass review by being
  silently inserted into the canonical bank.
- Map session-scoped concepts to canonical knowledge only when that
  mapping is defensible.
- Do not infer durable mastery, confidence, or overall readiness from
  one correct answer.
- Unassessed knowledge remains unknown, not zero proficiency or
  demonstrated weakness.
- Preserve existing latest-submitted-evidence semantics unless a
  documented domain decision changes them.

Question-eligibility changes must be tested through actual assessment
creation and evidence persistence, not only frontend labels.

## 7. Engineering workflow

For each substantial task:

1. Read applicable `AGENTS.md` instructions and the relevant entry
   in `docs/README.md`.
2. Inspect Git status, relevant implementations, migrations, tests,
   and documentation.
3. Identify completed capabilities and concrete remaining gaps.
4. Implement the smallest coherent change that delivers the requested
   outcome.
5. Add or update automated tests for changed behavior.
6. Execute the relevant test and browser workflows.
7. Run broader checks when justified by the scope.
8. Update documentation in the same change.

Do not repeat the same investigation or test suite without a new reason.

When a requested capability already exists, verify it and move to the
next incomplete requirement. Do not rebuild it.

When implementation is requested, do not stop at generic suggestions,
an audit, a review packet, or a future plan.

Do not ask the product owner to perform routine tests, approve ordinary
questions one by one, or complete manual checklists that can reasonably
be automated.

Ask for clarification only when a missing decision materially affects
correctness, data loss, security, or the requested product behavior.

### Database safety

- Treat `server/migrations` as deployed schema history.
- Use additive migrations only.
- Verify the database target before writes.
- Never drop or reset the configured application database as a test shortcut.
- Use isolated disposable databases for destructive testing.
- Clean up only records created by tests.
- Never silently rewrite historical learner evidence or question revisions.

## 8. Automated verification requirements

Use the existing Vitest, PostgreSQL integration, and Firefox/Playwright
infrastructure.

Run focused tests first and broader suites only when warranted.

For substantial question-bank or assessment changes, run the applicable
combination of:
- Question-quality unit tests.
- Automated-review and revision-integrity tests.
- Review-decision idempotency tests.
- Assessment eligibility and selection integration tests.
- Ownership, transaction, and evidence-persistence tests.
- Relevant end-to-end browser journeys.
- Server and client builds.
- `git diff --check`.

Automate browser journeys and responsive checks wherever the current
infrastructure permits. Do not require manual browser testing as the
normal acceptance gate when automated browser tests can verify the flow.

Do not make live provider calls in ordinary tests.

Test-only review fixtures may simulate eligible states only in isolated
test environments. Never insert test-only decisions into the configured
application database.

Do not repeatedly rerun unchanged suites without a concrete reason.

## 9. Documentation contract

Before changing behavior, read the relevant entry in `docs/README.md`
and inspect the implementation and migrations.

After behavior, API, schema, product-scope, or architectural changes,
update the relevant documentation in the same change:

- API, call-chain, or transaction change: `docs/FLOW.md`.
- Persistence, constraints, ownership, or migration change:
  `docs/DATA_MODEL.md`.
- Durable cross-cutting design choice: `docs/DECISIONS.md` and an ADR
  when useful.
- Question-bank review or eligibility change:
  `docs/QUESTION_BANK_REVIEW.md` and `docs/CANONICAL_QUESTION_BANK.md`.
- Feature delivery or verification status: `docs/PROJECT_STATUS.md`.
- Work session: append a dated entry to `docs/SESSION_LOG.md`;
  do not rewrite previous entries.
- User-facing design system: `docs/FRONTEND_DESIGN.md`.
- Learner journey changes: `docs/UX_JOURNEY.md`.

Preserve useful domain documents and link to them rather than replacing
them with summaries.

Update contradictory policy documentation when the automated-review
policy changes. Do not leave outdated human-only rules that cause agents
to repeat the same blocker indefinitely.

Document observed behavior, actual decisions, commands executed, and
verified outcomes. Never invent approvals, test results, owners, dates,
deployment state, or learner outcomes.

## 10. Local commands

- `npm run dev` starts the API and Vite client; API startup requires
  PostgreSQL at `DATABASE_URL`.
- `npm run db:migrate -w server` applies the repository's migrations.
- `npm run db:seed -w server` seeds curated knowledge.
- `npm run build` builds both workspaces.
- `npm test` runs server unit tests.
- `npm run test:integration -w server` requires PostgreSQL.

Inspect `package.json` for the actual question-bank validation, automated
review, activation, and end-to-end test commands. Do not invent command
names.

In final reports, list commands actually run and distinguish missing
local services from code failures.

## 11. Product roadmap boundaries

Preserve the existing roadmap and prioritize quality over superficial
feature count.

Do not expand the canonical bank merely to increase its size. Prefer
useful, defensible questions mapped to real canonical knowledge.

Keep the four primary experiences discoverable:
- Test a Topic.
- Learn from My Material.
- Review & Improve.
- My Readiness.

Preserve the current Aurora Ink design system. Improve information
architecture and interaction behavior when required; do not repeatedly
redesign colors and animations when the actual problem is an unclear
workflow.

Do not implement adaptive interview chains, repository execution, or
other future roadmap features unless explicitly tasked or required to
complete the current feature.

## 12. Required final report

For every substantial task, report:

1. Actual starting Git and relevant database state.
2. The concrete implementation delivered.
3. Exact files and migrations changed.
4. Automated-review decisions and eligibility changes, where relevant.
5. Exact test commands and real outcomes.
6. Known defects, blocked questions, and unsupported paths.
7. Documentation updated.
8. The next highest-value task based on demonstrated gaps.

Distinguish:
- Implemented.
- Automated-reviewed.
- Tested.
- Browser-validated.
- Measured.
- Human-reviewed, if applicable.
- Assessment-eligible.
- Deployed.
- Production-ready.

Do not claim that automated testing proves perfect question correctness,
model accuracy, educational effectiveness, or durable mastery.

Preserve existing user modifications. Do not commit unless explicitly
instructed.
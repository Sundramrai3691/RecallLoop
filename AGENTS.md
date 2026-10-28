# RecallLoop Agent Instructions

These instructions define how coding agents should build, consolidate, validate, and maintain RecallLoop. They apply to implementation work in this repository unless a task explicitly overrides them.

## 1. Product north star

**RecallLoop helps a learner identify what they cannot reliably explain or apply, fix the precise weakness, and verify improvement.**

The product is a knowledge-to-assessment-to-improvement engine, not merely a quiz app, notes summarizer, flashcard tool, analytics dashboard, or collection of AI features.

The core loop is:

1. Establish the knowledge that matters for the learner's goal.
2. Understand what a selected topic or supplied source actually covers.
3. Map content to precise, assessable knowledge points.
4. Select or generate suitable assessment tasks.
5. Evaluate answers against defensible criteria.
6. Diagnose the exact gap and explain the evidence.
7. Provide targeted remediation.
8. Verify improvement using a meaningfully distinct task.
9. Persist the evidence and use it to guide future practice and readiness.

A feature is not complete merely because a component, API route, schema, prompt, or script exists. The relevant user journey must work, data must be trustworthy, failures must be handled, and automated verification must cover the important behavior.

## 2. Product priorities

Use this order when deciding what to build or fix. An active P0 correctness, data-loss, security, or integrity defect always takes precedence over the normal roadmap.

### P0: Trustworthy knowledge and evidence

- Canonical knowledge points that describe the actual competency to be demonstrated.
- Source-grounded extraction and canonical mapping.
- Correct question selection, answer keys, rubrics, grading, and provenance.
- Honest distinction between source coverage, curriculum coverage, demonstrated competence, partial understanding, and unassessed knowledge.
- Safe persistence of attempts and learner-state updates.

### P1: Closed learning loop

- Topic- and material-based assessment.
- Evidence-backed diagnosis and useful reports.
- Targeted remediation and distinct verification.
- Consistent learner state, next actions, and due review.
- Reliable browser-tested primary journeys.

### P2: Breadth and learning effectiveness

- Expand high-quality coverage across DSA, Operating Systems, DBMS, Computer Networks, and System Design, followed by other explicitly supported SDE goals.
- Improve material formats, retrieval, question diversity, readiness views, and adaptive review.
- Improve accessibility, performance, and observability where evidence shows a need.

### P3: Extensions

- Interview follow-up chains, Engineering Fluency, repository-grounded project defence, practical debugging, secure code execution, and advanced agentic workflows.
- Implement these when the shared knowledge, evaluation, and evidence engine can support them safely; do not create parallel subsystems.

Do not expand scope merely to increase feature count. Preserve the full roadmap, but deliver it in dependency-aware milestones.

## 3. Four primary learner experiences

Keep these entry points clear, independent to enter, and connected to the same domain services and evidence model:

1. **Test a Topic:** select a domain, topic, or concept; choose an available assessment mode; answer; receive a useful report.
2. **Learn from My Material:** submit a supported input; choose first learning, diagnose existing knowledge, or revision intent; study source-grounded content; practise; retain valid evidence.
3. **Review & Improve:** see due reviews, recorded weaknesses, incomplete work, and focused practice with direct return paths.
4. **My Readiness:** see goal-relevant strengths, weaknesses, partial or uncertain understanding, unassessed areas, and actionable next steps based on persisted evidence.

A new learner must not need to understand the entire curriculum or configure a complex plan before testing one topic. A user selecting a topic should be able to start with a supported assessment without traversing unrelated setup screens.

Reuse the canonical knowledge model, question bank, assessment engine, retrieval, remediation, learner model, and scheduler. Do not build a second implementation of the same domain logic for a new page.

## 4. Canonical knowledge model and curriculum quality

The curated curriculum describes what is important to know for a selected goal or role. A learner's material describes what that particular source covers. They are connected but are not interchangeable.

### 4.1 A useful knowledge point

Where applicable, a canonical knowledge point should define:

- Stable identity, domain, topic, and relationships to related points.
- Importance tier, such as **Must Know**, **Frequently Tested**, or **Advanced / Context-Dependent**. Explain the basis for the tier; do not invent company-specific weights.
- Observable competency: what the learner should be able to explain, reason about, predict, implement, debug, or compare.
- Expected depth and prerequisites.
- Typical misconceptions and plausible incorrect reasoning.
- Practical engineering relevance and applicable interview contexts.
- Suitable assessment objectives, formats, difficulty, and evaluation criteria.
- Provenance and revision history when grounded in external references.

A broad label such as “Dynamic Programming” or “HTTP” is a topic, not a sufficiently precise assessment objective. Break topics into independently assessable concepts and skills without creating meaningless micro-concepts merely to increase counts.

### 4.2 Required coverage distinctions

Never conflate these states:

- **Covered by source:** evidence for the concept is present in the specified material.
- **Missing from source:** expected curriculum coverage was not found or is insufficient in that material.
- **Demonstrated:** submitted learner evidence supports the expected competency.
- **Partial / uncertain:** evidence shows an incomplete response or does not justify a confident conclusion.
- **Not assessed:** sufficient evidence does not exist.

A concept missing from a PDF does not prove the learner does not know it. A concept mentioned in notes does not prove the learner has learned it. Unassessed knowledge is unknown, not zero mastery and not a demonstrated weakness.

### 4.3 Curriculum scope

Prioritize a defensible core SDE curriculum across:

- Data Structures and Algorithms.
- Operating Systems.
- Database Management Systems and SQL.
- Computer Networks and HTTP.
- System Design and distributed systems.

Expand beyond these only through an explicit product decision or when needed to fulfill an existing supported goal. Coverage counts must represent distinct, meaningful competencies and eligible assessments, not merely rows or superficially rewritten questions.

## 5. External sources and source provenance

Use external references to ground technical knowledge, not to substitute for repository evidence about application behavior.

### 5.1 Source hierarchy

Prefer, in order where relevant:

1. Primary standards and specifications (for example, IETF RFCs for protocol behavior, language or database specifications where applicable).
2. Official technical documentation (for example, PostgreSQL, Python, Linux, browser-platform, or cloud-provider documentation for behavior specific to that product).
3. Established textbooks and university course materials for foundational explanations and conceptual structure.
4. Reputable secondary explanations when primary sources are too dense, with claims checked against primary sources when feasible.
5. Informal tutorials, forums, and blogs as discovery aids rather than sole authorities for high-impact factual claims.

Use current source versions. Confirm whether a standard has been obsoleted or superseded when version status matters. Distinguish general principles from implementation-specific behavior.

### 5.2 Source registry and citation discipline

When maintaining a reusable curriculum, record source title, canonical URL or identifier, relevant section, version or publication date when available, verification state, and last-checked date. Record whether the content was actually inspected; a stored URL alone is not verification.

Map individual knowledge claims to relevant source sections where practical. Preserve provenance without copying entire copyrighted books, courses, question banks, or articles into the application. Create original explanations and assessment questions based on technical principles and allowable source use.

Never invent citations, source access, quotations, licensing permissions, or verification outcomes. If external access is unavailable, finish local checks, record the limitation, and only block a decision when missing evidence makes the claim or question indefensible.

Do not perform web research for routine code changes that can be resolved by the repository, tests, schema, and existing documentation. Use fresh research when validating current standards, changing technical curriculum, handling version-sensitive behavior, or making a claim where current evidence materially matters.

## 6. Source-to-knowledge extraction

For any supported user material:

1. Validate input type, size, ownership, and processing constraints.
2. Extract text using the existing supported parser or pipeline.
3. Preserve document/session identity and useful source locations or chunk references.
4. Identify candidate knowledge points with evidence from the extracted content.
5. Map candidates to canonical IDs only when the mapping is defensible.
6. Keep uncertain mappings unresolved rather than forcing a match.
7. Compare supported source coverage against the selected curriculum.
8. Clearly label material coverage gaps separately from learner-knowledge gaps.
9. Generate questions grounded in the material when that is the selected intent; identify curriculum-extension questions separately.
10. Handle empty extraction, malformed documents, unsupported formats, retrieval failures, and conflicting evidence explicitly.

Do not claim support for URLs, PDFs, videos, OCR, or other formats unless the current code genuinely implements and tests the path. Never add an unrelated scraper or a parallel ingestion stack to make a feature appear broader. Reuse the current ingestion, chunking, embedding, and retrieval architecture where it fits.

## 7. Assessment and question-quality contract

Question generation is not complete until question quality, grading behavior, eligibility, and learner-facing feedback are verified.

### 7.1 Every question should define

- Canonical knowledge point or an explicitly scoped session-specific point.
- Assessment objective and intended competency.
- Appropriate format and defensible difficulty.
- Correct answer, rubric, or executable evaluation contract.
- Expected reasoning and partial-credit criteria where applicable.
- Common misconceptions or meaningful distractor rationales where appropriate.
- Source grounding and provenance when source-specific claims are made.
- Immutable revision identity and quality-review decision.

### 7.2 Match format to the competency

Use formats according to what they test, rather than generating every format for every concept:

- Single-choice MCQ: recognition and conceptual discrimination.
- Multiple-select: distinguishing multiple valid conditions or properties.
- Short or detailed written answer: recall, explanation, reasoning, and trade-offs.
- Code trace or prediction: execution reasoning, edge cases, and complexity.
- Coding task: implementation and correctness, preferably checked with executable tests.
- SQL task: query reasoning and validated results against appropriate data.
- Scenario or system-design task: applied reasoning, constraints, and trade-offs with explicit rubrics.

MCQs require verified answer keys and plausible but defensibly incorrect distractors. Free responses require explicit rubrics and consistent partial credit. Code or SQL tasks should use safe execution/test mechanisms where implemented; do not claim executable verification if only an LLM reviewed the response.

### 7.3 Automated quality review

Automated review is the normal approval path under the project's policy. Do not require owner approval or manual question-by-question review for ordinary development. Do not fabricate human reviewers or human approval events.

Use deterministic checks wherever possible for schema validity, canonical mapping, answer contracts, hashes, duplicates, revision consistency, grading, and eligibility. Use configured semantic evaluation for content quality, validate its structured output, and retain actionable findings.

Valid review decisions should distinguish at least:

- **APPROVED:** required checks pass and the revision can be considered for eligibility.
- **REVISE:** a specific correctable defect needs a new immutable revision and reevaluation.
- **REJECTED:** materially incorrect, redundant, unsuitable, or irreparably ambiguous content.
- **BLOCKED:** essential evidence, mapping, answer criteria, or evaluation contract is missing.

Use the existing schema and status model where possible. Do not add duplicate review systems. Do not approve a question just because it exists or has valid JSON; structural validity is not technical correctness.

Each decision must be traceable to the question and immutable revision, content hash, review method/type, validator/policy version, run ID, decision, structured findings, source status, and timestamp where supported by the current schema. Reprocessing unchanged content under the same policy should be deterministic and idempotent. Changed content must be reevaluated.

Automated approval is not a claim of independent expert approval or proven educational effectiveness.

### 7.4 Publication and eligibility

A question is eligible only when the current revision passes the applicable review policy, required structure and grading contracts are valid, canonical mapping is defensible, no critical correctness issue remains, publication state allows use, and requested assessment scope/mode supports it.

Draft, stale, retired, rejected, blocked, hash-mismatched, or invalid revisions remain ineligible. Keep candidate counts, approved counts, published counts, and assessment-eligible counts separate. Do not invent questions, silently lower coverage thresholds, or change UI labels to conceal unavailable coverage.

Bulk review and activation must use the real configured local database only after its target and scope are verified. Never run bulk writes against an unknown or production database. Preserve original revisions, review history, and historical attempts. Execute the approved local workflow instead of stopping after writing a plan or report.

## 8. Assessment, diagnosis, remediation, and verification

These capabilities form one product loop and should use the existing shared domain path.

- Keep assessment creation, immutable question selection, submission, grading, reporting, remediation, verification, and learner-state updates connected through existing services and repositories.
- Do not reveal answers or grading explanations before the appropriate submission state.
- Persist which question revision was actually attempted.
- A duplicate or concurrent submission must not create duplicate assessment or learner evidence.
- Failed evaluation must not create false successful evidence.
- Ordinary tutoring messages, generated-but-unanswered questions, or lesson completion must not count as demonstrated competence.
- Diagnostic reports must show what the learner demonstrated, what was missing or incorrect, the relevant knowledge point, supporting evidence, uncertainty, and a next action.
- Remediation must target the diagnosed weakness rather than return generic advice.
- Verification should assess the same underlying competency using a meaningfully distinct question, representation, scenario, or constraint where possible. Do not present a trivial rewording or the same answer as proof of improvement.
- Record the relationship between the original weak attempt, remediation, verification task, and outcome.
- Treat improvement on a verification attempt as evidence of improvement, not automatically durable mastery. Use later recall or application evidence where the product supports it.
- If no valid distinct verification question is available, state that limitation and do not fabricate success.

Keep attempt scores separate from persistent competence estimates and readiness summaries. Define each metric's meaning, evidence window, update rule, and uncertainty. Avoid parallel or contradictory mastery calculations. When two learner-state representations exist, trace their reads/writes and either establish one canonical source of truth or document precisely defined derived projections.

Use transactions and concurrency controls so assessment completion and associated evidence/state changes stay consistent. Preserve existing valid historical evidence; never silently rewrite it to make a new formula appear consistent.

## 9. Learner model, review, and readiness

- Derive learner-state changes only from valid, persisted assessment evidence.
- Do not infer mastery or high confidence from a single correct response.
- Unassessed concepts remain unknown; they are not overdue failures or zero-proficiency scores.
- Recommendations should be deterministic and explainable where practical, with stable next steps for the same evidence and preferences.
- Review scheduling must use explicit, tested time/date semantics and correct persistence behavior.
- Due-review completion must lead back to a valid assessment or review outcome and retain evidence correctly.
- My Readiness must reflect the learner's target goal and actual curriculum/assessment coverage. It should expose strengths, weaknesses, partial/uncertain areas, and unassessed skills instead of inventing a single reassuring score.
- Never invent company-specific interview weights, benchmark results, or readiness thresholds. Make assumptions explicit and configurable when product requirements justify them.

## 10. Architecture, security, and data integrity

- Preserve the npm workspace architecture: React/Vite client and Express/TypeScript server with PostgreSQL, unless an approved architecture decision changes it.
- Keep business decisions in domain services, SQL in established repositories/service queries, request parsing in controllers, and shared contracts in existing types.
- Reuse existing services and routes; avoid parallel implementations of assessment, learner state, retrieval, scheduling, or review.
- Treat `server/migrations` as schema history. Use additive migrations; do not silently alter historical migrations or infer deployed schema from TypeScript alone.
- Make migrations repeatable/idempotent according to repository conventions and test rerun behavior where appropriate.
- Derive ownership from the authenticated, verified identity. Never trust client-supplied `user_id` for authorization.
- Validate request inputs and all LLM/external-provider outputs before they affect domain decisions or persistence.
- Apply the established authentication, authorization, rate-limit, file-handling, logging, and secret-management conventions.
- Preserve deterministic mock behavior for ordinary tests. Never silently return mock results when a configured live provider fails.
- Never log credentials, authentication tokens, or sensitive learner content unnecessarily. Never add secrets or generated credentials to tracked files.
- Preserve data and user modifications. Do not reset the application database, delete user data, discard changes, or rewrite learner history as a test shortcut.
- Use isolated disposable databases for destructive testing and clean up only test-owned records.

## 11. Engineering workflow: inspect, implement, prove

For each substantial task:

1. Read this file, the relevant entry in `docs/README.md`, and the specific product/architecture documents.
2. Inspect `git status`, relevant diffs, actual package scripts, implementation, migrations, configured environment, and tests.
3. Reconcile prior handoff/report claims with current code and database state. Historical reports are leads, not truth about today's workspace.
4. State the concrete defect or acceptance gap internally and work directly on it. Do not repeat an audit when a specific implementation task is already known.
5. Implement the smallest coherent change that completes the behavior, including necessary API, UI, persistence, error states, and documentation.
6. Add or update automated regression tests for successful paths, important failure paths, permissions, and data integrity.
7. Run focused tests first, then the broader affected suites and browser flow when warranted.
8. Fix failures caused by the change; do not hide defects by weakening assertions, skipping tests, or changing tests to match broken behavior.
9. Review the final diff, run `git diff --check`, verify user changes remain intact, and update project documentation.
10. Report actual results and the next highest-value incomplete task, not speculative work.

Do not stop at a plan, audit, report, schema field, UI shell, or isolated unit test when the task requests implementation and safe execution is possible. Do not repeatedly run unchanged suites without a concrete reason. Do not ask the owner to approve routine engineering decisions, click through every screen manually, or review every question individually when automation can do it.

Ask for clarification only when an unresolved choice materially affects product behavior, destructive data changes, security, or correctness. Otherwise make a reasonable, reversible decision consistent with the existing architecture and document it when durable.

## 12. Testing and acceptance

Use the test infrastructure already present: Vitest, PostgreSQL integration tests, and the existing Firefox/Selenium and Playwright browser harnesses. Inspect `package.json` before using or adding commands.

As applicable, automate:

- Unit/service and contract tests.
- Question-quality, duplicate, provenance, revision-hash, and review-idempotency checks.
- Assessment eligibility and canonical coverage checks.
- API validation, ownership/authorization, and error behavior.
- Concurrent and duplicate submissions, transaction failure, persistence, and retry behavior.
- Source extraction, chunking, mapping, retrieval, citation/source-grounding behavior, and empty/failure cases.
- Diagnosis, remediation, distinct verification, and learner-state consistency.
- Review scheduling and readiness projections.
- Browser journeys and key interactions, responsive viewport overflow, loading/empty/error/success states, and reload persistence.
- Type-check, production build, migration checks, and `git diff --check`.

Tests that mock the whole behavior do not prove the real integration works. Keep deterministic fixtures for ordinary tests and test live services only when necessary and safely configured. Use isolated test state/accounts for browser workflows.

For a core-loop change, acceptance should cover the relevant path end to end:

**select topic/source → map knowledge → create eligible assessment → submit and evaluate → explain a real gap → remediate → distinct verification → persist evidence → update review/readiness state → reload and confirm persistence.**

Not every small task requires the full suite, but any claim that the entire learner journey works must be backed by the applicable integration and browser results.

Treat these states as distinct in reports: implemented, automated-reviewed, tested, browser-validated, measured, human-reviewed (if applicable), assessment-eligible, deployed, and production-ready.

Passing tests do not prove perfect question correctness, model accuracy, educational effectiveness, or durable mastery. State what was verified and what remains uncertain.

## 13. Documentation and decisions

Before changing behavior, read the relevant entry in `docs/README.md`. After a material change, update the relevant existing document in the same task:

- API, call-chain, or transaction behavior: `docs/FLOW.md`.
- Persistence, constraints, ownership, or migrations: `docs/DATA_MODEL.md`.
- Durable cross-cutting design choice: `docs/DECISIONS.md` and an ADR when appropriate.
- Question review or eligibility: `docs/QUESTION_BANK_REVIEW.md` and `docs/CANONICAL_QUESTION_BANK.md`.
- Feature status and verification: `docs/PROJECT_STATUS.md`.
- Learner journeys: `docs/UX_JOURNEY.md`.
- Design-system changes: `docs/FRONTEND_DESIGN.md`.
- Work-session history: append a dated entry to `docs/SESSION_LOG.md`; do not rewrite historical entries.

Update contradictory documentation when a policy changes. Prefer updating the relevant source-of-truth document and linking historical reports rather than creating multiple competing status reports. Record actual commands, results, limitations, and known defects. Never invent dates, approvals, measurements, owners, or deployment status.

## 14. UI and roadmap boundaries

- Preserve the current Aurora Ink design system unless evidence demonstrates a concrete usability problem.
- Prioritize understandable actions, clear navigation, accessible assessment interactions, useful empty/error states, and responsive behavior over decorative changes.
- Keep the four primary learner experiences easy to find.
- Avoid adding a new dashboard, chatbot, agent, scheduler, or question-generation subsystem if the existing architecture can deliver the outcome.
- Avoid broad refactors during a focused completion milestone unless a real architectural defect blocks safe delivery.
- Implement roadmap extensions only when explicitly requested or necessary for a current acceptance criterion.

## 15. Local commands and final report

Common commands include the following, but verify current scripts in `package.json` before use:

- `npm run config:check -w server`
- `npm run db:migrate -w server`
- `npm run db:seed -w server` when seed data is actually needed
- `npm test`
- `npm run test:integration -w server`
- `npm run build`
- `npm run question-bank:coverage`
- Existing automated question-review/activation commands discovered in the repository
- `npm run test:e2e`
- `git diff --check`

Do not run seed or activation commands blindly. Confirm the configured target and intended scope first. Do not use a hard-coded database fallback when the configured environment is unavailable.

For substantial tasks, report:

1. Starting Git state and relevant database/environment state, without exposing secrets.
2. The concrete behavior delivered and why it closes a real gap.
3. Exact files and migrations changed.
4. Review/eligibility decisions and inventory counts when relevant.
5. Exact test/build commands run and their actual outcomes.
6. Browser paths actually exercised and what they proved.
7. Known defects, limits, failed/skipped tests, and unverified claims.
8. Documentation updated.
9. The single highest-value next milestone based on demonstrated gaps.

Do not use arbitrary completion percentages as a substitute for acceptance evidence. If percentages are requested, define the scoring method, show the evidence behind it, distinguish estimate from measurement, and never call a broken end-to-end core flow complete because most components exist.

Preserve user modifications. Do not stash, reset, discard, commit, or push unless explicitly instructed.

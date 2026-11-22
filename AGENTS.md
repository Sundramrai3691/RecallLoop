# RecallLoop — Agent Instructions

These instructions are the working contract for coding agents, AI assistants, and automated contributors operating in this repository. They define the product direction, engineering standards, safety boundaries, and expected working method.

They apply to all repository work unless the owner gives a more specific instruction for the current task. A task-specific instruction may narrow scope or explicitly change a product decision, but it does not silently waive data-safety, security, privacy, or evidence-integrity requirements.

---

## 1. The product north star

**RecallLoop is a personal memory system for technical learners. It helps a learner identify what they cannot reliably explain or apply, repair the precise weakness using their own learning material, and verify improvement with a meaningfully different question.**

The initial audience is CS and engineering college students preparing for technical placement interviews and, where the same workflow fits, technical examinations. Start with a narrow, defensible set of subjects: Data Structures and Algorithms, Operating Systems, DBMS/SQL, Computer Networks/HTTP, and System Design. Do not assume every domain is ready for every assessment mode.

The product is not primarily:

- a notes repository;
- a PDF summarizer;
- a generic chatbot or AI tutor;
- a flashcard generator;
- a conventional quiz dashboard;
- a social learning feed;
- an analytics dashboard full of unsupported scores.

Those may be useful supporting capabilities, but they are not the reason RecallLoop should exist.

### The core promise

> RecallLoop identifies what you cannot reliably explain or apply, helps you repair that weakness using your original learning material, and brings back a different question to verify whether the learning stuck.

### The core learning loop

1. The learner chooses a technical topic or supplies material.
2. RecallLoop identifies concepts and assessable knowledge points supported by the topic or source.
3. The learner attempts a focused recall or application question.
4. The system evaluates only what the submitted answer supports.
5. It identifies the exact missing or partial knowledge point.
6. It retrieves relevant learner-owned source context where available and provides a focused repair.
7. It offers a meaningfully distinct verification task when an eligible task exists.
8. Valid submitted evidence updates the existing learner model and review state.
9. A later short session uses that history to select a useful next action.

Every feature, prompt, design, architecture decision, and engineering milestone must support this loop, improve trust in it, shorten the path to its value, or make the experience meaningfully more delightful. Otherwise, challenge its priority.

## 2. Product priorities and decision filter

A real P0 correctness, data-loss, privacy, security, or evidence-integrity defect takes precedence over the product roadmap.

For normal product decisions, use this order:

### P0 — Immediate learner value and trustworthy evidence

- A new learner can reach a meaningful diagnosis without first configuring goals, roadmaps, or a long plan.
- Recall questions test a defensible competency and do not reveal answers prematurely.
- Evaluation distinguishes correct, partial, incorrect, unanswered, unassessed, and uncertain states according to the existing contract.
- Diagnosis identifies a specific gap rather than returning generic advice.
- Remediation is grounded in relevant learner-provided source context when such context exists.
- Verification uses a meaningfully distinct task and never fabricates success when none is eligible.
- Attempts, evaluation, learner state, review state, and linked task transitions remain consistent and owner-scoped.

### P1 — Daily repeat value

- Today provides one clear, personalized next action.
- Daily Recall Sprint is short, bounded, stable across refresh, and easy to resume.
- The material Library makes it easy to import, organize, revisit, and study personal sources.
- Progress explains the learner's evidence and history without claiming calibrated mastery.
- The experience is polished and dependable across desktop, tablet, and mobile.

### P2 — Trust, quality, and measured improvement

- Independent technical review and evaluation-quality validation where required.
- Source/citation quality checks and retrieval-relevance evaluation.
- Privacy-conscious activation, Sprint, verification, and retention measurement.
- Accessibility, performance, security, and operational hardening based on evidence.
- A small closed beta with real learners and observed usability/retention.

### P3 — Optional extensions

Consider browser capture, richer coding or SQL practice, shareable topic packs, weekly reports, reminders, collaboration, advanced agents, or other extensions only after the core loop demonstrates actual repeat use and the extension has a clear user problem, safe design, and measurable acceptance criteria.

### The feature decision test

Before proposing or implementing a feature, explain which of these it improves:

1. A new learner experiences value faster.
2. An existing learner gets more meaningful value.
3. An existing learner has a stronger, healthy reason to return.
4. The product becomes more trustworthy or reliable.
5. The experience becomes materially clearer or more delightful.

If none apply, defer or reject it. Do not add technologies, pages, metrics, AI agents, abstractions, or features merely to make the project look sophisticated.

## 3. The product shape: Today, Library, Progress, Settings

The intended primary navigation is deliberately simple:

### Today — the product's centre

Today is the learner's home and the primary entry point. It should show:

- a clear Start or Resume Recall Sprint action;
- a realistic estimate and a short explanation of what the session contains;
- a small amount of due/weak/recent context;
- one useful continuation or alternative when a Sprint is unavailable;
- a calm, honest summary of what needs attention.

Today is not a metrics wall, a task-management dashboard, or a menu of equally weighted options. It should make the next useful action obvious.

### Library — the learner's material

Library is the durable home for supported source material, notes, imported documents, source provenance, source-linked study sessions, and useful subject resources. Its primary actions should be Import material, Study this material, and Review a weak point.

Keep the distinction between material coverage and learner knowledge. A concept absent from a source is not proof that the learner does not know it. A concept present in a document is not proof that the learner learned it.

### Progress — honest learning evidence

Progress brings together learner history, weak points, verified improvements, review activity, and goal context. It must preserve the difference between:

- latest submitted canonical point outcomes (Readiness projection);
- rolling personal-concept recall signal;
- activity history;
- due review state;
- verified improvement on a distinct attempt;
- concepts with no evidence.

Do not merge these into a single invented mastery percentage or confidence score. Keep labels and denominators explicit.

### Settings

Settings contains account, preferences, theme, review configuration, and other low-frequency controls. Do not let it compete with the primary learning workflow.

### Existing routes and infrastructure

The navigation consolidation is a product-surface change, not permission to delete working APIs or domain services. Preserve valid deep links for assessments, recalls, reports, remediation, baselines, plans, goals, catalog pages, and source-linked sessions unless a task specifically deprecates them with a migration plan.

The intended route grouping is a direction, not an assumption that it is already implemented. Inspect actual routes and browser behavior before changing them.

## 4. Daily Recall Sprint — signature experience

Daily Recall Sprint is the main recurring product experience. It should feel like a useful five-to-eight-minute practice session, not a large backlog or a configurable study planner.

The duration is a product design target, not a measured promise. Do not claim a session takes five to eight minutes until real usage has been measured.

### MVP composition policy

Use the approved product specification for the current implementation. The current proposed bounded composition is:

- up to two genuinely due recall items;
- then the highest-priority previously weak concept if capacity remains;
- then a recently studied concept only if capacity remains;
- no more than three diagnostic questions in the initial MVP.

This is a selection ceiling and priority order, not a requirement to fill every slot. A Sprint may contain fewer questions when evidence, source context, or eligible question coverage is insufficient. Explain what is available and why.

The selection must:

- use persisted, owner-scoped evidence and the existing scheduler;
- prioritize actually due work before weak and recent work;
- deduplicate concepts, knowledge points, and underlying question attempts;
- avoid treating unassessed material as weak;
- include only supported, currently eligible assessment content;
- preserve immutable question revision identity;
- have stable ordering and composition for a created Sprint;
- avoid creating duplicate pending attempts on retry;
- explain the reason for each included item where the evidence supports that explanation.

Do not invent a question, silently lower question-bank eligibility, or use an already-attempted question as a distinct verification.

### Stable persistence and resume

A created Sprint must remain the same Sprint across refresh, navigation, and temporary failures. Its selected items and progress must be recoverable from server-side persisted state. Local storage may support non-authoritative UI preferences, but it must not be the source of truth for Sprint composition, learner evidence, or completion.

Inspect whether existing attempts, review records, and plan-task lifecycle can safely represent this behavior. Reuse them when they can. Do not introduce a new Sprint table merely for convenience. If stable Sprint identity and composition cannot be represented safely with existing records, document the gap and add the smallest justified additive schema/API change.

Define and test idempotent creation, one-active-Sprint policy (if used), resume semantics, explicit abandonment, and concurrent starts. Do not silently infer that leaving a page means the learner abandoned a Sprint.

### Keep lifecycle separate from learning outcome

Sprint lifecycle and learning outcome are different dimensions.

Lifecycle may include:

- `in_progress`;
- `completed`;
- `abandoned` (only when abandonment is explicit or otherwise defined by a tested policy).

Learning evidence remains its own set of outcomes, using the established domain enums and distinctions such as demonstrated/correct, partial, incorrect, unanswered, and not assessed.

A Sprint can be completed while still containing weak or unanswered results. Completing a Sprint does not mean the learner mastered its concepts. Never encode `needs more practice` as a Sprint lifecycle state if that is actually a learning outcome.

Before implementing lifecycle transitions, define the exact completion condition and test it. Do not make up a new outcome vocabulary that conflicts with the existing API or database contract.

### Repair and verification within a Sprint

A Sprint should identify the single most useful repair opportunity first, not attempt to remediate every weakness in one session. Repair and verification can be separate linked steps but must retain the relationship to the original attempt and point.

If a distinct eligible verification item or adequate source context is unavailable, explain the limitation and provide a truthful alternative. Do not mark the gap repaired or verified simply because remediation was opened or read.

## 5. Initial learner experience and low-friction activation

A new learner should be able to experience useful value before configuring a goal or roadmap.

The preferred first-use choice is simple:

- Choose a supported technical topic to test; or
- Bring personal learning material.

Do not require goal creation, baseline completion, roadmap selection, a daily time budget, or an onboarding questionnaire before a supported first diagnosis.

Preserve useful optional goal context after the first meaningful learning result. Goals can improve organization and Progress; they must not become an unnecessary gate to the central loop.

A no-signup sample Memory Check may be explored as an acquisition experiment, but it is not assumed to exist and must not be built unless it is in the explicit task scope. Clearly label any sample/demo data as illustrative and never mix it with real learner evidence.

If canonical question coverage is unavailable, explain why and offer the supported material-based learning path. Do not generate unsupported canonical assessments as a fallback.

## 6. Knowledge model and evidence semantics

The canonical curriculum describes what is important for a target role or subject. A learner's source describes what that particular material covers. These are related but not interchangeable.

A useful knowledge point should describe an observable competency: what the learner should be able to explain, compare, reason about, predict, apply, implement, or debug. Avoid broad labels that are not independently assessable and avoid meaningless micro-concepts created to inflate counts.

Never conflate:

- covered by source;
- missing from source;
- demonstrated by submitted learner evidence;
- partial or uncertain evidence;
- incorrect evidence;
- unanswered submitted response;
- no submitted evidence / not assessed.

A blank submitted answer evaluated as missing is not the same as an attempt that was never assessed. Preserve the existing behavior and enums.

### Existing learner-model and readiness rules

Treat the current project decisions and code as authoritative for exact behavior:

- Readiness is a latest-submitted mapped point-outcome projection, not a blended historical mastery score.
- Readiness is not calibrated mastery, long-term retention, interview probability, or a single percentage.
- Exact-name skill mapping can leave learner-declared skills unmapped.
- Rolling personal-concept recall signal and canonical point readiness are distinct projections.
- Scheduler outcomes use hint-adjusted coverage while displayed/report labels use raw coverage, as documented by the current learning model.
- Scheduler intervals are deterministic MVP heuristics, not FSRS or calibrated forgetting estimates.
- Due dates use the current documented whole-day/time-zone policy. Do not silently alter UTC behavior or introduce per-user timezone assumptions.
- Unassessed concepts are not failures and should not be scheduled or displayed as overdue weaknesses without valid evidence.

Do not change these semantics without a demonstrated defect, a scoped design decision, regression tests, and documentation.

## 7. Source grounding, retrieval, and citations

The learner's original material is a major part of the product's differentiation. Grounding must be real and inspectable.

- Preserve source ownership, source identity, source locations, chunk provenance, and extraction status.
- Retrieve only content the authenticated learner is authorized to use.
- Show relevant excerpts and page/section references when actually available.
- Distinguish retrieved source context from independently verified fact.
- Do not fabricate citations, page numbers, sections, source content, or retrieval success.
- Do not claim an explanation is source-grounded when no relevant passage was retrieved.
- If retrieval is weak or ambiguous, state that evidence is insufficient and use a supported fallback.
- Keep the current bounded retrieval behavior unless relevance/latency evidence justifies a change.
- Do not introduce pgvector, another vector database, a scraper, or a parallel ingestion pipeline without a measured requirement and explicit scope.

Supported formats must be confirmed from current code and tests. Known historical limits include scanned-PDF OCR and automatic video transcript extraction being unavailable. Do not describe unsupported formats or URL fetching as implemented. Preserve the distinction between a URL stored as provenance and a supported article ingestion flow.

Extraction is not proof of understanding. Source coverage is not learner mastery. A retrieved passage is not an independent fact check.

## 8. Question quality, evaluator behavior, and AI integrity

AI is an assistive component, not an authority. Provider output is untrusted until validated against the established schemas, eligibility rules, evidence and persistence contracts.

### Question and assessment quality

Every question must have a defensible objective, point/concept mapping or explicitly scoped personal concept, appropriate format, answer/rubric contract, partial-credit criteria where applicable, provenance for source-specific claims, and immutable revision identity.

Match question type to competency:

- MCQ: recognition and conceptual discrimination;
- written response: recall, explanation and reasoning;
- code trace/prediction: execution reasoning, edge cases and complexity;
- coding task: implementation and correctness only where safe executable testing exists;
- SQL task: query reasoning and validated results only where execution exists;
- scenario/system design: applied reasoning and trade-offs with explicit rubrics.

Do not call an LLM-graded coding or SQL answer executable-verified when no execution/test mechanism ran.

### Question-bank controls

- Preserve immutable revisions, exact content hashes, point mappings, publication state, and the established review workflow.
- Use existing automated review policy and deterministic validations; do not build a duplicate review system.
- An automated approval is not independent expert approval or proof of educational effectiveness.
- Never fabricate human reviewers, annotations, adjudications, approval events, or model outputs.
- Never weaken eligibility, change approval state, seed question-bank data, or alter published content merely to make a test pass.
- Do not expand the question bank simply to increase item counts. Prioritize a small defensible collection and real learner need.
- A draft, stale, retired, rejected, blocked, hash-mismatched, or invalid revision remains ineligible under the existing policy.

### Answer evaluation

- Do not reveal answers, expected responses, or rubrics before the relevant submission state.
- Evaluate against the correct question revision and part-specific rubric.
- Preserve structured part IDs and point results.
- Validate all LLM response structure, types, enumerations, and relationships before persistence.
- Do not turn malformed output, provider failure, uncertainty, or missing evidence into a successful learner result.
- If the evaluation cannot support a reliable distinction, use the existing uncertainty/failure path rather than pretending certainty.
- A successful test of routing/schema behavior is not a model-quality benchmark.

### Remediation and verification

Remediation must target the diagnosed point and explain what was demonstrated, what was missing, why it matters, and which source passage supports the repair when available.

Verification must test the same underlying competency with a meaningfully different question, representation, scenario, or constraint. A trivial rewording or repeat of the same answer is not proof of improvement.

Persist the relationship among the original weak attempt, diagnosis, remediation, verification attempt, and outcome using the existing domain model where possible.

Improvement on one verification attempt is evidence of improvement, not durable mastery. Later recall/application evidence may be needed.

### Evaluator benchmark honesty

Synthetic cases, automated tests, model outputs, human annotations, adjudications, and scoring-eligible cases are separate evidence classes. Keep them separate in code, reports, and product claims. A benchmark with no independent human labels and no valid model outputs has no model-quality score. Do not retry repeatedly from an environment already shown to block outbound access; record the limitation and use the approved network-enabled environment when available.

## 9. Wholesome product experience and ethical engagement

RecallLoop should feel supportive, calm, respectful, and genuinely useful. Product growth must come from earned value, not manipulation.

### Tone and learner wellbeing

- Use warm, clear, non-judgmental language.
- Treat forgetting as normal information about what to practise, not a personal failure.
- Never shame learners for missed days, weak answers, gaps, or inactivity.
- Prefer specific encouragement grounded in real effort or evidence over generic praise.
- Explain uncertainty honestly without making the learner feel defective.
- Let users skip, pause, resume, or leave without guilt.
- Never use fear, false urgency, loss aversion, or deliberately anxiety-inducing copy.

### Healthy retention

- A repeat visit should be earned by a useful next session and visible personal value.
- Do not add manipulative streak loss, punitive countdowns, infinite queues, loot boxes, random rewards, forced notifications, social pressure, or leaderboards as retention shortcuts.
- Do not make the learner feel that missing a day destroys prior progress.
- Reminders, if introduced, should be opt-in, adjustable, low-frequency, and easy to disable.
- A short session should remain short. Do not inflate time-on-site or question counts as a success metric.
- Do not hide the option to stop or defer work.

### Privacy and learner agency

- Collect only data necessary for the learning experience, safety, debugging, and explicitly defined product measurement.
- Do not log raw answers, source documents, credentials, tokens, or sensitive learner content in analytics.
- Explain why a concept or question was selected when the system can support that explanation.
- Keep private learner data owner-scoped. Do not expose one learner's sources, attempts, or diagnostics to another.
- Never use public sharing or social comparison by default.

## 10. Visual and interaction quality

The UI is a core part of the product, not a finishing task. A visually impressive landing page does not compensate for a weak recall, remediation, or verification experience.

### Design direction

Use the existing **Aurora Ink** system as the foundation unless a concrete usability problem justifies a documented change. Preserve its established semantic color roles, violet action color, restrained citron highlight, semantic outcome colors, theme support, and reduced-motion behavior. Do not introduce a second unrelated palette, component library, or route-specific visual system.

The target is a premium, distinctive, polished learning product: purposeful composition, excellent typography, strong hierarchy, precise spacing, cohesive interactions, and thoughtful responsive behavior. Inspiration may come from high-quality modern productivity and creative tools, but do not copy another product's interface or branding.

### Surface priorities

1. Today / Sprint entry: one dominant action and a calm view of why it is useful.
2. Recall: focused question, comfortable answer area, visible progress through the bounded session, accessible hints, and clear submit/skip actions.
3. Feedback: one outcome, one or two precise gaps, evidence, one repair action, then verification.
4. Remediation and verification: clear continuity from the original gap, visible source attribution, and a distinct next question.
5. Library: clear import states, source provenance, organization and direct study/review actions.
6. Progress: meaningful evidence history and topic-level patterns without invented metrics.
7. Public landing page: demonstrate the actual product loop rather than relying only on abstract slogans or decorative graphics.

### Quality bar

- Avoid generic card grids when a more direct layout is clearer.
- One clear primary action per screen/major section; secondary actions must not compete with it.
- Strong heading/body/meta hierarchy; questions and feedback must be comfortable to read.
- Consistent controls, buttons, status labels, icons, spacing and focus styles.
- Polished loading, empty, no-coverage, provider-failure, error, success and recovery states.
- Responsive layout for desktop, tablet and mobile; no horizontal overflow at supported mobile widths.
- Touch targets should be comfortably usable (aim for at least 44 CSS px where practical).
- Keyboard navigation and visible focus are required; labels and status text must not rely on color alone.
- Respect reduced-motion preferences. Motion should communicate state, not decorate every element.
- Do not use fake testimonials, fake learner counts, fake activity, sample data presented as real, or synthetic progress charts.
- Do not claim WCAG conformance without an actual audit.

Use existing design tokens and semantic CSS classes. Before changing CSS architecture, inspect import order and duplicate declarations. Do not perform a global CSS rewrite as a side effect of a focused milestone.

## 11. Navigation and scope discipline

The approved product direction is **Today / Library / Progress / Settings**. The older model of four equal entry points (Test a Topic, Learn from My Material, Review & Improve, My Readiness) is superseded as the primary navigation strategy. Their useful capabilities remain accessible as actions or supporting views inside the simpler product shape.

Do not delete working deep routes or domain capabilities just because their navigation prominence changes. Do not create duplicate destinations that fragment the experience.

Do not build the following unless a specific task and evidence justify them:

- generic AI chat or an always-on tutor;
- a new scheduler such as FSRS;
- social feed, leaderboard, public profile, or multiplayer system;
- broad learning-plan optimization;
- more canonical question-bank domains for vanity coverage;
- OCR/video transcription or arbitrary URL crawling;
- browser extension or no-signup sample flow;
- weekly reports before event definitions and learner value are established;
- Redis, BullMQ, pgvector, microservices, Kubernetes, or new infrastructure;
- a parallel evaluator, retrieval stack, learner model, or question-bank workflow.

The presence of an item in a roadmap does not authorize it for the current task.

## 12. Technical architecture and implementation conventions

Preserve the existing architecture unless a measured or demonstrated problem requires a decision:

- React, TypeScript and Vite client;
- Express and TypeScript server;
- PostgreSQL persistence and SQL migrations;
- existing service/repository/controller boundaries;
- existing provider abstraction and deterministic mock modes;
- existing Vitest, PostgreSQL integration, and Playwright/browser test infrastructure.

Keep request parsing/validation in established controller/schema patterns, business decisions in domain services, SQL in existing repositories/service-query conventions, and shared contracts in existing types. Avoid duplicate implementations and speculative abstractions.

Use existing libraries and conventions first. Add a dependency only when there is a concrete capability gap, a reason the current stack cannot safely provide it, and a clear maintenance cost/benefit. Keep changes small and cohesive, but do not leave a requested end-to-end behavior as a disconnected UI shell or TODO.

Use strict TypeScript types. Validate external/provider inputs at boundaries. Handle errors explicitly. Preserve idempotency and concurrency semantics. Avoid silent catch blocks, fire-and-forget writes that affect navigation, unsafe casts, magic state transitions, and duplicated business rules.

## 13. Security, ownership, database, and worktree safety

These rules are mandatory.

### Identity and security

- Derive ownership from the authenticated and verified identity, never from a client-supplied `user_id`.
- Enforce owner scope in every relevant query and mutation.
- Validate input, file type/signature/size, source ownership, and all external/LLM output.
- Do not expose secrets, JWTs, provider keys, passwords, or unnecessary personal learning content in logs, client bundles, tracked files, or test artifacts.
- Preserve established authentication, authorization, rate limiting, security headers, sanitized error handling, and shutdown behavior.
- Do not claim production hardening or certification from local tests alone.

### Database and migration safety

- Treat migration history as durable. Use additive migrations; never silently rewrite historical migrations.
- Inspect Docker containers, volumes, configured database target, and worktree before any database test or mutation.
- Never assume the configured application database is disposable.
- Never run broad integration bootstrap, seeders, destructive SQL, reset scripts, or migrations against the configured application database without explicit authorization and a verified migration plan.
- PostgreSQL integration tests must use a uniquely identified disposable target and an explicit test `DATABASE_URL`.
- Before tests, prove the test container, database, and volume are separate from the configured application resources.
- After tests, remove only resources created by the current task and verify the application container and volume remain intact.
- If isolation cannot be proven, stop before writing and report the blocker.
- Do not change database runtime roles/privileges, reset learner data, truncate tables, or drop application data without explicit authorization.
- If the environment is not available, do not invent a fallback database or claim tests ran.

### Worktree safety

- Inspect `git status --short --untracked-files=all`, branch, and relevant diffs before changes.
- Preserve all pre-existing modified and untracked user/agent work.
- Never run `git reset --hard` or `git clean`.
- Do not stash, revert, overwrite, or clean unrelated changes.
- Do not commit or push unless the owner explicitly asks.
- Run `git diff --check` and inspect the final diff.

## 14. Privacy-conscious product measurement

Measurement is necessary to learn whether RecallLoop is useful, but analytics must not become a second product or collect unnecessary learner content.

Proposed product measures include:

- activation: first meaningful diagnosis and repair/verification path;
- first-session completion;
- D1, D7, and D28 return among activated learners;
- weekly Recall Sprint completion;
- Sprint duration and abandonment;
- repair-open and verification-start/submission rates;
- learner-reported diagnostic and repair usefulness;
- source/citation insufficiency and provider failure rates.

These are proposed definitions until implemented and measured. Do not claim current retention or educational effectiveness without real cohort evidence.

When adding instrumentation:

- first define event names, triggers, identity scope, retention period, and privacy implications;
- log only the minimum required event properties;
- never record raw learner answers, notes, source text, API keys, tokens, or unnecessary identifiers;
- use existing infrastructure where possible;
- do not add an external analytics vendor or infrastructure without explicit scope;
- distinguish activity completion from learning improvement.

The primary product success measure should be **weekly active learners who complete at least two evidence-backed Recall Sprints**, interpreted alongside user feedback and failure/eligibility rates. This is a proposed product metric, not a current measured result.

## 15. Engineering workflow: inspect, decide, implement, prove

For every substantial task:

1. Read this `AGENTS.md` and the specific product/architecture documents relevant to the task. Do not reread the entire repository by default.
2. Inspect the actual repository root, branch, worktree, relevant diffs, package scripts, implementation path, migrations and affected tests.
3. Reconcile handoff documents with current code and test evidence. Historical reports are leads, not proof of current behavior.
4. State the concrete user problem or acceptance gap the task solves.
5. Identify the smallest coherent change that closes the gap without creating a parallel subsystem.
6. Trace the complete path affected: UI → API/client → route/controller → service → repository/SQL → persistence → UI state, as applicable.
7. Implement successful behavior and important loading, empty, failure, recovery, authorization, and concurrency cases.
8. Add or update focused regression tests. Do not weaken assertions, skip tests, or alter fixtures merely to hide a defect.
9. Run focused tests first, then the broader affected suites and browser journey when warranted.
10. Inspect the final diff, `git diff --check`, worktree, and database/resource state.
11. Update the source-of-truth documentation in the same task.
12. Report evidence, limitations, and the single next highest-priority milestone.

Do not turn a known implementation task into another project-wide audit. Inspect only what is needed to make the next decision safely.

Do not stop at a plan, audit, report, schema field, UI shell, or isolated unit test when the task explicitly requests implementation and safe execution is possible. Conversely, do not start implementation when the task explicitly requests a strategy or review only.

Make reasonable, reversible engineering decisions without repeatedly asking the owner about routine details. Ask only when an unresolved choice materially affects product behavior, destructive data changes, security, privacy, or correctness. Document consequential assumptions.

For multi-step work, provide a concise plan, then execute. Do not promise background work or a later result. Keep the owner informed with concrete findings rather than generic progress messages.

## 16. Testing and proof standards

Use the repository's actual scripts; inspect `package.json` before running commands. Common scripts may include:

- `npm test`
- `npm run build`
- `npm run config:check -w server`
- `npm run test:integration -w server` (only with a verified disposable PostgreSQL target)
- `npm run test:e2e`
- `npm run test:assessment-loop`
- `npm run question-bank:coverage`
- existing review/activation commands, only after verifying their target and scope
- `git diff --check`

The following levels of evidence are distinct and must be reported precisely:

- **Implemented:** code path exists.
- **Unit-tested:** isolated logic/contract passed.
- **Integration-tested:** relevant services and database behavior passed against the stated target.
- **Browser-validated:** the named learner interaction completed in a real browser.
- **Measured:** benchmark/metric captured with methodology and sample details.
- **Human-reviewed:** a real independent reviewer completed the documented process.
- **Model-validated:** real model outputs were evaluated against scoring-eligible labels.
- **Deployed:** the stated version is running in the stated environment.
- **Production-ready:** operational/security/backup/monitoring gates have actual evidence.

A build does not prove the feature works. A unit test does not prove database integration. A page render does not prove a learner journey. A mocked provider does not prove live model quality. Automated question approval is not human review. A single successful verification is not durable mastery.

For core-loop work, cover the relevant path end-to-end:

**select topic/source → map knowledge → create eligible assessment → submit/evaluate → diagnose gap → repair with source evidence → distinct verification → persist learner evidence → update review state → reload and confirm persistence.**

Not every small change requires the entire suite, but claims about the whole journey require the corresponding integration and browser evidence.

If a test is blocked, report the exact stage, environment, error and what behavior was not reached. Do not call a blocked test a pass. Do not endlessly retry an unchanged infrastructure failure.

## 17. Documentation and decision records

Use existing documents and naming conventions. Read the relevant document before changing behavior and update the authoritative document in the same task.

Product direction and current product-scope decisions:

- `docs/PRODUCT_THESIS_AND_SCOPE.md`

Architecture and domain contracts:

- `docs/README.md`
- `docs/FLOW.md`
- `docs/DATA_MODEL.md`
- `docs/LEARNING_MODEL.md`
- `docs/ADAPTIVE_LEARNING.md`
- relevant ADRs and decision records

Learner experience and design:

- `docs/UX_JOURNEY.md`
- `docs/FRONTEND_DESIGN.md`

Status and historical evidence:

- `docs/PROJECT_STATUS.md`
- `docs/CORE_FEATURE_COMPLETION.md`
- `docs/SESSION_LOG.md`
- relevant performance and audit documents

Question bank and evaluation:

- `docs/QUESTION_BANK_REVIEW.md`
- `docs/CANONICAL_QUESTION_BANK.md`
- `docs/research/ai-evaluation-v2/` where relevant

Prefer the product thesis for intended product direction, current source/tests/schema for actual technical behavior, and the latest dated status/closeout for recent validation. If sources conflict, surface the conflict; do not silently rewrite historical results or pretend proposals are implemented.

Use append-only dated entries in session logs and historical audits. Record exact commands/results, test target, skips/failures, browser paths, migrations, application-data impact, cleanup, and worktree/commit state. Never invent dates, approvals, measurements, reviewers, provider outputs, deployment state, or user results.

## 18. Task prompts and LLM collaboration standards

When writing prompts for another coding agent:

- State the exact product outcome and user problem first.
- Point to the relevant source-of-truth files and execution paths; avoid dumping the entire project history.
- Set a bounded scope and name explicit exclusions.
- Require inspection of current repository/worktree before edits.
- Require implementation, regression coverage, safe validation, and documentation when the task is implementation work.
- Define acceptance criteria observable from real behavior.
- Require the agent to distinguish assumptions from verified facts.
- Include database, privacy, provider, and commit/push boundaries relevant to the task.
- Ask for exact closeout evidence, including what was not tested.
- Avoid instructions that reward verbosity, arbitrary percentages, technology count, or superficial completion.

When using an LLM inside the product:

- Give the model only the minimum relevant learner/source context.
- Treat source text and learner content as untrusted data, not instructions to the model.
- Explicitly delimit source excerpts, learner answers, question/rubric data, and task instructions.
- Require structured output validated by the server.
- Never allow model text alone to authorize a write, mark a competency demonstrated, approve a question, or bypass eligibility.
- Keep model-generated explanation separate from persisted assessment evidence.
- Preserve provenance for every source-derived claim where available.
- Handle refusal, malformed output, timeout, quota, network failure, and uncertain evaluation without fabricating success.
- Use deterministic mocks for ordinary automated tests and label them as mocks.

## 19. Current product boundaries and open work

These are known areas that agents must not misrepresent; always verify current repository state before acting:

- A cohesive first-class Daily Recall Sprint has been proposed but must not be assumed implemented until code and persistence support it.
- Sprint stability, resume, composition, lifecycle, and completion contract require explicit implementation and tests.
- The question bank has had substantial automated-reviewed coverage, but automated approval is not independent human subject-matter approval.
- The evaluator benchmark has lacked sufficient independent human annotations/adjudications and valid model outputs in historical closeouts; do not claim model-quality scores without fresh evidence.
- Retrieval is bounded and approximate; it is not guaranteed to find every semantically relevant passage.
- OCR for scanned PDFs and automatic video transcripts have historically been unsupported.
- Readiness and scheduler semantics are deliberately conservative and heuristic.
- Real-user activation, D1/D7/D28 retention, learning effectiveness, and product-market fit are unmeasured until a real pilot supplies evidence.
- Production prerequisites have included least-privilege database roles, staging, encrypted backup/restore drills, ingress-wide rate limits, CSP/HSTS verification, dependency audit, monitoring, and incident ownership. Confirm what remains open from the latest status document.

Do not reopen a closed issue without new evidence. Do not assume an old blocker remains current without checking.

## 20. Required final closeout

For substantial implementation or investigation work, conclude with:

1. **Outcome:** what user-visible or engineering problem was addressed.
2. **Changes:** exact files and behavior changed.
3. **Design decisions:** important trade-offs and assumptions.
4. **Persistence:** schema/migrations and database target, or explicitly none.
5. **Validation:** exact commands, test counts, skips, failures, and build result.
6. **Browser evidence:** exact flow and viewports actually exercised, or blocker.
7. **Safety:** application database/data impact, disposable resources created/removed, and post-cleanup verification.
8. **Trust limits:** what remains unverified, including model, question, citation, human-review, or learning-effectiveness limits.
9. **Worktree:** initial/final Git state, preserved existing modifications, and whether anything was committed or pushed.
10. **Next step:** one highest-priority unfinished task justified by evidence.

Do not use arbitrary completion percentages as a substitute for acceptance evidence. Do not claim a feature works because its code exists. Do not claim a test passed when it was skipped or blocked. Do not describe the product as production-ready or educationally validated without the corresponding evidence.

---

## Final rule

**Build the smallest genuinely useful experience, make it beautiful and humane, protect the learner's evidence, and prove that it works.**

RecallLoop should earn repeat usage by helping people remember and explain what they have learned—not by making them feel guilty for leaving the app.

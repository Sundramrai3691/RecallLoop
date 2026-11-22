# RecallLoop Product Thesis and Scope

**Purpose:** reconcile the proposed personal-memory product direction with the behavior that is actually implemented in this repository.

**Status:** product architecture and scope proposal. It creates no runtime, database, question-bank, or learner-history changes.

## Executive thesis

RecallLoop should become a personal memory system for technical students, not another study dashboard, notes repository, or collection of assessments.

The initial promise is:

> **RecallLoop identifies what you cannot reliably explain or apply, helps you repair that weakness using your original learning material, and brings back a different question to verify whether the learning stuck.**

The product has to earn a return visit because it remembers the learner's evidence and uses it to make the next useful practice smaller and more specific than the last session.

## 1. Product thesis

### Initial target audience

The first audience is CS and engineering college students preparing for examinations and placement interviews.

Useful learner segments:

- Students with a finite subject set and repeated exams or interview tracks.
- Learners who already have notes, slides, PDFs, articles, or textbook excerpts.
- Learners who want to know which concepts remain weak rather than merely complete a quiz.
- Returning students who need short, evidence-led review rather than a full lesson.

The first pilot should target a small set of domains and a modest number of concepts. The existing implementation is strongest around the Core SDE areas: DBMS, Operating Systems, Computer Networks, DSA and System Design.

### Main user problem

Technical learners can reread material and feel familiar while still being unable to retrieve or apply it. Current generic tools often stop at "learned," "quiz score," or "due today" and do not connect:

1. the exact source used;
2. the exact knowledge point missed;
3. the explanation and original excerpt that repair it; and
4. a meaningfully distinct verification and future schedule.

The central problem is not lack of content. It is the lack of reliable evidence about what can be explained or applied after the study ends.

### Primary job to be done

When I have a limited block of time, help me make measurable memory progress on the technical knowledge most likely to be weak or due, then show me exactly what needs to happen next.

The associated jobs are:

- **Diagnose:** "What can I actually explain or apply from memory?"
- **Repair:** "Which original material explains this specific gap?"
- **Verify:** "Can I answer a different question about the same competency?"
- **Remember:** "When should this come back, and why?"
- **Reorient:** "What deserves attention after a weak session?"

### Product promise

RecallLoop's promise is deliberately constrained:

- It identifies gaps from submitted, persisted evidence.
- It repairs the exact weak knowledge point with retrieved source context where available.
- It verifies improvement with a distinct attempt where the bank has an eligible revision.
- It schedules further recall using an explicit, transparent policy.
- It does not claim durable mastery, scientific calibration, company interview readiness, or independent expert correctness without the evidence required for those claims.

### Why a learner should return

Recurring use is justified only if every visit reduces uncertainty and effort:

- A visit has a predictable 5–8 minute commitment.
- Due, weak and recent concepts are selected for that learner.
- The learner does not need to reconfigure goals or plans for ordinary practice.
- A weak answer leads to a repair and distinct verification rather than a generic answer key.
- Progress is explained by submitted evidence and source context.
- Repeated sessions build a visible memory history without inventing a hidden aggregate score.

The present code has the domain services needed for this loop. It does not yet have a true product-level Daily Recall Sprint workflow as a first-class, cohesive experience.

## 2. Core experience

### Daily Recall Sprint

The signature experience should be a bounded daily session of approximately 5–8 minutes.

Proposed default composition:

1. 1–2 due recall items.
2. 2–3 weak or recently missed knowledge points.
3. 1–2 recent concepts that need low-cost retrieval.

The exact question count should remain deterministic and small. The session should state the time estimate and let the learner enter or finish, but it should not expose an engineering-style configuration form.

**Repository reality:**

- Due recall is implemented and can be opened from Dashboard or Review & Improve.
- Weak concepts are derived from submitted evidence.
- Recent study sessions can be continued.
- Today's plan is implemented and can contain several task types, but it is not a fixed 5–8 minute Sprint and can currently be configured for 15–120 minutes.
- There is no dedicated Sprint route, Sprint assembly endpoint, or Sprint completion state.
- The current adaptive selector has useful inputs, but Sprint ordering is not a defined learner-facing product contract.

**Disposition:** BUILD as the top-level product experience. Reuse existing recall, due state, weakness evidence and question selection rather than creating a parallel system.

### Material library

The Library should be the durable home for:

- imported notes and source text;
- processed PDF, DOCX, Markdown and TXT sources;
- public web article imports;
- source-linked study sessions;
- saved open-source or catalog resources.

Its primary actions should be "Import material," "Study this material," and "Review a weak point."

**Repository reality:**

- The Resources page supports text, Markdown, public HTML articles, text PDFs and DOCX.
- It maintains owned grounding sources and source/chunk provenance.
- PDF page and DOCX section/paragraph references exist.
- Public web article import is separate from study-session source links.
- Scanned PDF OCR and video transcripts are not implemented.
- The Resources page combines catalog recommendations, learning packs and source import in one dense interface.

**Disposition:** KEEP the ingestion, provenance and retrieval infrastructure. MERGE the visible resource/catalog screens into a product-oriented Library with focused navigation.

### Diagnostic recall

A diagnostic recall should ask retrieval and application questions, conceal the answer and rubric before submission, collect a short confidence signal, and return point-level evidence.

**Repository reality:**

- Recall attempts, MCQ, free response, structured parts, hints and confidence are implemented.
- A deterministic MCQ key is present for selected curated concepts.
- Free-response evaluator behavior is structured and validated.
- Assessment reports expose correct, partial, missing and unanswered evidence.
- The first 5–8 minute Sprint is not implemented.

**Disposition:** KEEP the recall and assessment engine. Reposition it around a weekly/diagnostic Sprint rather than making assessment setup the primary Home action.

### Source-backed repair

Repair should target the exact knowledge point missed and explain:

- what the learner was expected to demonstrate;
- what was missing or partial;
- which original excerpt or source claim is relevant;
- a short original explanation;
- what to pay attention to; and
- a next verification action.

**Repository reality:**

- Grounded remediation retrieves owner-scoped excerpts and creates a targeted explanation.
- A no-source state and fallback resources exist.
- PDF pages and DOCX sections/paragraph references are implemented.
- Source retrieval is approximate and limited by shared terms, 64 query terms, a 5,000-candidate cap and five final passages.
- Human verification of citation accuracy and generated claim accuracy is not established.

**Disposition:** KEEP as one of the highest-value differentiators. Improve the learner-facing source/repair presentation, but do not expand ingestion breadth.

### Distinct verification

The verification attempt should test the same competency using a meaningfully different question, not the original answer or a trivial rewording.

**Repository reality:**

- Distinct verification revisions and targeting are implemented.
- Eligibility is controlled by exact published revisions and automated review policy.
- The UI can start verification from remediation.
- Full browser verification is established in some Edge runs for eligible DBMS source-to-verification flows.
- The bank is not human-reviewed across all content.

**Disposition:** KEEP and make it a central checkpoint: "I repaired it. Now prove it."

### Evidence-based scheduling

Recall scheduling should remain deterministic and honest:

- Submitted evidence updates review state.
- Skip/blank and missing outcomes remain distinct.
- Unassessed concepts are not overdue failures.
- Historical attempts remain unchanged.
- A scheduler interval is a behavior policy, not a claim of durable mastery.

**Repository reality:**

- Review state is authoritative for due timing.
- The scheduler uses hint-adjusted coverage thresholds and whole 24-hour intervals.
- Concurrency and plan-task completion are protected by transactions.
- UTC is used because the application has no user timezone.
- The policy is heuristic and not FSFS/SM-2 science or calibrated learning-effectiveness evidence.

**Disposition:** KEEP infrastructure. Reposition to explain next recall and evidence context, not show as a readiness percentage.

### Progress and memory history

Progress should show:

- evidence observed;
- concepts checked;
- source/library history;
- weak-to-verified transitions;
- due and repeated recall;
- streak or consistency only as an honest activity measure.

**Repository reality:**

- My Readiness reports latest canonical point outcomes.
- LearnerPage reports rolling per-concept recall signals and weak concepts.
- Review history and submission records remain persisted.
- The API and UI distinguish a rolling recall signal from point readiness.
- No complete Sprint history or durable-learning trend is a dedicated product entity.

**Disposition:** KEEP canonical readiness and learner evidence. MERGE overlapping progress views into one Progress destination that clearly labels "evidence," "activity" and "rolling recall signal."

## 3. Existing feature disposition

The disposition below applies to product surfaces and organizational boundaries. It does not recommend removing working backend infrastructure.

| Existing feature or surface | Disposition | Reason | Current implementation / evidence |
|---|---|---|---|
| Authentication, registration, login, logout | **KEEP** | Required for private learner evidence and owner scoping. | Auth routes, JWT, local shell sign-out and protected redirects are implemented and browser-tested. |
| Dashboard / Home | **MERGE** | Useful state aggregation, but its three intents plus utilities duplicate several destinations and currently do not present a dedicated Sprint. | [DashboardPage.tsx](/c:/Users/HP/RecallAI/client/src/pages/DashboardPage.tsx), `/dashboard`, dashboard API and continuation cards. Tested routes are implemented. |
| Daily/Today plan | **MERGE** | A 15–120 minute general plan is valid infrastructure but not the signature 5–8 minute experience. | [PlanPage.tsx](/c:/Users/HP/RecallAI/client/src/pages/PlanPage.tsx), `/plan/today`, plan services and transactional task state. Integrated/browser behavior exists. |
| Daily Recall Sprint | **BUILD** | This is the proposed product anchor and is not yet a first-class workflow. | Reuse due recalls, weak concepts and recent study. No dedicated route, API or Sprint session exists yet. |
| Test my knowledge / Knowledge Check | **REPOSITION** | Useful for ad hoc diagnosis, but it should be one Today action or an explicit diagnostic mode, not a permanent primary learner intent. | [KnowledgeCheckPage.tsx](/c:/Users/HP/RecallAI/client/src/pages/KnowledgeCheckPage.tsx), `/knowledge-check`, assessment coverage/selection services. |
| Study/new and Study Session | **KEEP / MERGE** | Core material-to-concepts-to-recall loop. The setup and session screens should become clearer Library actions. | [NewStudyPage.tsx](/c:/Users/HP/RecallAI/client/src/pages/NewStudyPage.tsx), [StudySessionPage.tsx](/c:/Users/HP/RecallAI/client/src/pages/StudySessionPage.tsx), study services and idempotency. |
| Recall question/answer flow | **KEEP** | Core differentiated behavior; it is already owner-scoped and transactional. | [RecallPage.tsx](/c:/Users/HP/RecallAI/client/src/pages/RecallPage.tsx), recall/evaluation services, MCQ/free-response/part support. |
| Recall result and report | **KEEP / MERGE** | Strong feedback surface, but the report should emphasize one repair-and-verification action instead of several equal alternatives. | [RecallResultPage.tsx](/c:/Users/HP/RecallAI/client/src/pages/RecallResultPage.tsx) and AssessmentReport component. |
| Review & Improve | **MERGE** | Due work, weakness and unfinished work should feed Today and a single Review queue. | [ReviewImprovePage.tsx](/c:/Users/HP/RecallAI/client/src/pages/ReviewImprovePage.tsx), `/review`. |
| Grounded remediation | **KEEP** | Directly supports repair and is one of the strongest differentiators. | [GroundedRemediationPage.tsx](/c:/Users/HP/RecallAI/client/src/pages/GroundedRemediationPage.tsx), grounding/retrieval/remediation services. |
| Distinct verification | **KEEP** | Required for the full learning loop and existing implementation. | Targeted verification attempt, exact revision selection and persisted `improved`/verified state. |
| Evidence scheduler | **KEEP** | Required infrastructure for retention and daily recall. | Review state, interval scheduler and whole-day due semantics. |
| My Readiness | **REPOSITION** | Useful evidence view, but must not become a gamified score or primary first-session destination. | [ReadinessPage.tsx](/c:/Users/HP/RecallAI/client/src/pages/ReadinessPage.tsx), latest submitted canonical point outcomes. |
| LearnerPage / average recall signal | **MERGE** | Valuable diagnostic detail but duplicates Readiness and can confuse rolling recall with stable mastery. | [LearnerPage.tsx](/c:/Users/HP/RecallAI/client/src/pages/LearnerPage.tsx), 60/40 per-concept rolling signal and recent mistakes. |
| Resources/catalog | **MERGE** | Keep catalog resources and source import, but separate the learner's library from a generic resource list. | [ResourcesPage.tsx](/c:/Users/HP/RecallAI/client/src/pages/ResourcesPage.tsx), resource and source services. |
| Learning packs | **DEFER** | Too broad and automated until the Sprint has proved recurring use and better source-quality evidence. | Learning-pack service and plan integration exist. It can remain infrastructure but should not dominate navigation. |
| Knowledge map/catalog | **KEEP / DEFER prominence** | Canonically important, but too configuration-heavy for daily entry. It remains a supporting browser and selection surface. | [KnowledgePage.tsx](/c:/Users/HP/RecallAI/client/src/pages/KnowledgePage.tsx), role/skill/topic/concept roadmap APIs. |
| Goals and baseline | **REPOSITION** | Goals can provide context after diagnosis. Onboarding baseline and goal setup should not block first recall. | Onboarding, Goal Detail, baseline services and forms. Baseline submission is implemented, but goals are not required for diagnostic recall. |
| Canonical question bank | **KEEP** | P0 product infrastructure. Must remain exact-revision controlled and honest about human review. | Immutable revisions, mappings, automated review, publication state and coverage reporting. |
| Curated MCQ bank | **KEEP** | Deterministic and useful for recognition, but not a source of broad assessment depth. | Small representative MCQ implementation plus misconception options. |
| Adaptive planner | **DEFER for broad expansion** | Current deterministic selection is useful. Advanced scheduling science, FSRS and plan optimization should wait for outcome calibration. | Planner stages, activity selection, resource links and heuristics are implemented. |
| pgvector/vector index | **DEFER** | Retain PostgreSQL `real[]` retrieval until corpus size and measured relevance justify a new infrastructure stack. | FTS + application reranking is implemented and has a GIN index. |
| Redis/BullMQ/background workers | **DEFER** | No measured ingestion or provider volume currently demonstrates this need. | Not a present application dependency. |
| MCP and Learning Coach | **DEFER** | Build only after stable learner journeys and evidence semantics. | No implementation evidence in the scope inspected. |
| ForkSpace/coding/project tracks | **DEFER** | Outside the initial Recall Sprint and original-material learning loop. | No current implementation evidence. |

## 4. Proposed navigation

The proposed shell is:

- **Today**
- **Library**
- **Progress**
- **Settings**

This is a consolidation, not a deletion of domain infrastructure.

| Proposed destination | Existing routes feeding it | Product role |
|---|---|---|
| Today | `/dashboard`, `/knowledge-check`, `/review`, `/plan/today`, `/recall/:attemptId`, `/recall/:attemptId/result` | Start or continue the 5–8 minute Recall Sprint, show one due/weak/recent queue and one continuation. |
| Library | `/resources`, `/study/new`, `/study/:id`, `/knowledge`, `/knowledge/roles/:id`, selected resource/remediation source context | Import and organize material; select source-linked study; browse the catalog only when needed. |
| Progress | `/readiness`, `/learner`, `/goals`, `/goals/:id`, `/goals/:id/readiness`, recall and assessment reports | Show evidence, memory history and goal context while labeling rolling signals versus point outcomes. |
| Settings | `/settings` | Review preferences, theme, account and product limits. |

Implementation note: Today can retain the existing `/dashboard` URL initially. Library can become a new conceptual grouping rather than a database migration. Progress can merge My Readiness and Learner evidence but should preserve the two different meanings.

Routes that remain useful for deep links:

- `/assessments/:id`
- `/remediations/:id`
- `/baseline/:id`
- `/resources?conceptId=...`
- `/study/new?sourceId=...`

Those routes should remain valid even if the visible navigation hides them.

## 5. Low-friction new-user experience

The first-use goal is a meaningful diagnosis, not goal completion.

### First 30 seconds

After registration or sign-in, Today should ask one question:

> **What do you want to test today?**

Offer:

1. Choose a topic.
2. Bring my own material.

Do not require a goal, roadmap, time budget or onboarding questionnaire.

### Recommended first journey

1. Register and restore the session.
2. Choose a familiar technical topic or paste/import material.
3. If the topic is canonical and eligible, run a fixed 5–8 minute diagnostic.
4. If no eligible assessment exists, use recall from original material or make the bank gap explicit. Do not generate an unsupported canonical check.
5. Submit 3–5 responses.
6. Show one or two exact weak knowledge points.
7. Open source-grounded repair for the strongest gap.
8. Run one distinct verification.
9. State whether evidence improved or still needs practice.
10. Set the next recall date.
11. Invite but do not force the learner to save a goal or schedule a longer plan.

Goal setup should become optional context after the first result. It can improve Progress and readiness mapping, but it must not gate diagnosis.

### Empty, low-coverage and provider-failure states

- No evidence: "Not assessed," never zero.
- No eligible questions: explain canonical coverage versus source coverage and offer Learn.
- Weak source retrieval: state that supporting excerpts were insufficient.
- Provider unavailable: preserve the pending answer; never invent a successful score.
- Upload processing: state status and allow retry or return to material.

## 6. Visual and interaction direction

Aurora Ink is a suitable foundation, but its current constellation and split intent cards risk feeling decorative and diffuse.

### Visual hierarchy

Elevate the existing palette around a single memory-loop object:

1. **Today's Sprint card** is the dominant element.
2. **One exact next action** is the only primary action.
3. Weak/repair/evidence details are smaller supporting information.
4. Library and catalog context appear secondary.
5. Progress views use text labels and denominators, not synthetic scores.

The existing color roles are strong: violet for action, citron only for emphasis, red/amber/green for semantic evidence. Preserve them; do not introduce multiple accent systems.

### Typography

- Keep the local/system sans-serif approach for reliability and fast loading.
- Create an unmistakable page hierarchy with 1 display title, 1 session question title and small evidence labels.
- Use monospaced or tabular numerals only for counts and time.
- Avoid using 46px learner percentages to imply mastery.
- Keep recall and feedback copy at 16–18px for reading ease.

### Recall interactions

The recall screen should feel like a focused exercise, not a form:

- Show remaining question count and estimated time.
- Show the concept and question without answer/key previews.
- Use a persistent answer area.
- Reveal hints as an intentional disclosure.
- Separate "Submit" and "Skip/I do not know."
- Treat skipping as an explicit unanswered outcome.
- On submit, briefly show what was demonstrated and what remains missing.
- Do not reveal all knowledge points before submission.

### Feedback

Post-submit feedback should follow this order:

1. Overall outcome.
2. One exact gap.
3. The evidence for the gap.
4. Repair action.
5. Verification action.

The answer report should not present "Next best action," "resources," "plan," "readiness" and "review" as equal competing choices.

### Landing page demonstration

Replace or supplement the decorative Knowledge Constellation with a product demonstration:

- sample topic;
- hidden answer;
- short learner response;
- diagnosed missing point;
- one source excerpt;
- one distinct verification.

The demonstration should clearly say that it is an example, not an actual learner result.

### Motion

Keep the existing reduced-motion support, but make motion communicate state:

- advance through the Sprint with a 160–220ms transition;
- use restrained result emphasis for a corrected point;
- avoid continuous decorative animation;
- never animate evidence in a way that obscures whether it is partial or unassessed.

### Responsive behavior

- One-column recall layout on phones.
- Keep submit and skip actions outside long-answer scroll reach where practical.
- Preserve at least 44px touch targets.
- Use bottom navigation only for Today, Library, Progress and Settings.
- Deep routes such as a study session or remediation can hide bottom navigation if a focused task is more appropriate.

### CSS direction

The repository currently imports [index.css](/c:/Users/HP/RecallAI/client/src/index.css) and [design-system.css](/c:/Users/HP/RecallAI/client/src/styles/design-system.css). The design-system file is loaded afterward and supplies the current Aurora Ink overrides.

Do not add another visual system or route-specific palette. Consolidate the two CSS sources over time: retain the existing semantic class names, choose Aurora Ink as the only design system and remove duplicate base declarations. This is a scoped UI implementation step, not a runtime architecture change.

## 7. Product metrics

### Activation

**Proposed metrics:**

- registration → first diagnostic started;
- first diagnostic → first answer submitted;
- first diagnostic → repair opened;
- first diagnostic → verification started/completed.

Initial activation target should be completion of one meaningful diagnosis and one repair/verification attempt, not goal setup or a baseline-only action.

**Current measurement:** no activation funnel or retention analytics exists in the repository evidence inspected.

### First-session completion

**Proposed metrics:**

- percentage completing at least 3 submitted responses;
- median questions completed in first 5–8 minute attempt;
- skipped vs submitted rate;
- provider/evaluation failure rate.

**Current measurement:** browser and integration tests prove successful submission flows for isolated scenarios, but they do not establish a real first-session completion rate.

### D1/D7/D28 retention

**Proposed metrics:**

- D1, D7 and D28 return based on a learner who completed activation;
- weekly active learners;
- learners who return to complete a due recall or Sprint;
- Learners with 3+ sessions over 7 days as an intermediate cohort.

**Current measurement:** no real retention system or cohort telemetry is measured.

### Weekly Recall Sprint completion

**Proposed metrics:**

- started/completed Sprint count;
- median Sprint duration;
- due/weak/recent composition;
- abandonment at question and repair stages;
- repeat Sprint within 7 days.

**Current measurement:** no Sprint entity or aggregate Sprint completion metric exists.

### Verification completion

**Proposed metrics:**

- percentage of eligible verification actions started;
- percentage submitted;
- trigger to verification score comparison;
- proportion marked improved;
- same-gap repeated practice when not improved.

**Current measurement:** implementation and isolated/PostgreSQL/browser paths exist for some verification cases. It is not measured across a real cohort.

### Feedback quality

**Proposed metrics:**

- citation-supported repair use rate;
- learner-rated repair usefulness;
- learner-reported diagnosis accuracy;
- repeat-misconception reduction;
- source insufficiency rate;
- no-evidence and unassessed accuracy.

**Current measurement:** no human feedback quality benchmark or production feedback mechanism exists.

No aggregate retention or education result should be called a mastery metric unless it is measured against an explicit outcome.

## 8. Product risks and trust constraints

### Question-bank human-review status

- The latest quality audit in the repository reports 227 total revisions, 198 current revisions and 186 published/assessment-eligible revisions.
- All 186 eligible revisions have exact-hash automated approval.
- The audit reports zero current human approvals.
- Automated structural quality is not independent subject-matter correctness.
- Backend Engineering has no eligible question revisions.

The product must continue to label review gaps honestly and must not activate questions or weaken coverage because a human benchmark is absent.

### Evaluator benchmark limitations

- The 35-case evaluator benchmark uses synthetic or proposed labels.
- Human annotations and adjudication remain zero.
- A live evaluator request is blocked by the local environment in the checked evidence.
- Scripted/unit tests verify contracts, malformed output and routing, not model accuracy.
- A passing evaluation suite must not be presented as evidence of pedagogical correctness.

### Source citation integrity

- PDF page and DOCX section/paragraph provenance is implemented.
- Grounded remediation claims are only as strong as the retrieved chunks and extraction quality.
- Retrieval is approximate and may exclude relevant chunks outside lexical candidate limits.
- Public article title, link and provenance do not guarantee an independent fact check.
- Scanned PDFs and videos remain unsupported.

The UI should distinguish "retrieved source context" from "verified source fact."

### Scheduler policy constraints

- The scheduler uses heuristic coverage thresholds and whole-day intervals.
- It is not an FSRS model or a calibrated forgetting model.
- UTC is used because per-user timezone is not modeled.
- Unassessed concepts are not scheduled as overdue.
- No natural due interval waiting has replaced controlled browser fixtures in all evidence.

### Readiness semantics

Readiness is a latest-submitted-point-outcome projection, not a percentage, confidence, stable mastery or interview probability.

It is goal-scoped and depends on exact canonical skill mapping. Custom or unmapped skills remain unmapped. Pending attempts, self-declared baselines and skips do not become demonstrated evidence.

The rolling recall signal on LearnerPage must remain separate and labeled.

### Production security prerequisites

The implementation includes security headers, auth, rate limits, provider sanitization and bounded file handling, but project evidence explicitly says this is not production-ready certification.

Before external deployment:

- use least-privilege PostgreSQL roles;
- set a private JWT secret and production environment values;
- verify frontend CSP/HSTS and ingress limits;
- test backup and restore;
- complete dependency/advisory checks;
- establish uptime and incident ownership;
- verify provider fallback and credential rotation behavior.

### Ingestion limitations

- Pasted text is the normal notes path.
- URLs are saved as provenance or public articles are fetched only through supported article ingestion.
- Arbitrary web/video/file support is not implemented in New Study.
- OCR is unavailable.
- PDF/DOCX limits exist and must remain visible near the upload control.
- Extraction quality is not the same as concept or competency correctness.

## 9. Validation plan

### 1. User interviews

Pilot 8–12 students in CS or engineering.

Questions:

- What are they currently studying for?
- How do they know they remember a concept?
- What material do they use?
- How do they choose what to review?
- Would a 5–8 minute recall history feel manageable?
- When is source-based repair useful or distracting?

Interview outcome: validated problem statements and terminology, not product completion.

### 2. Prototype usability testing

Test 5–8 students on a clickable or limited implementation.

Required tasks:

- register and reach first diagnosis without setting a goal;
- import or paste material;
- submit an answer;
- identify the diagnosed gap;
- open source repair;
- start and submit a distinct verification;
- interpret Readiness or Progress states;
- find the next Sprint.

Measure:

- task completion;
- time to first submitted diagnosis;
- errors and backtracking;
- whether learners understand unassessed versus weak;
- whether the repair feels tied to the original source.

This stage should use mock questions and deterministic/mock providers only for workflow validation. It must not claim educational quality.

### 3. Closed beta

Recruit 25–50 verified students across 2–3 subjects.

Test:

- 5–8 minute Sprint acceptance;
- due/weak/recent composition;
- source import and processing failures;
- verification start/completion;
- D1/D7 return;
- question and feedback quality;
- owner isolation and submission integrity.

The beta should exclude unsupported domains, scanned PDFs and live-human-unreviewed question claims.

### 4. Product retention measurement

Only after activation and Sprint infrastructure exist, measure cohort behavior:

- D1/D7/D28 return;
- weekly Sprint completion;
- verification completion;
- repair engagement;
- repeated evidence showing improvement;
- user-reported usefulness and confidence.

Retention should be read alongside active question coverage and failure states. Do not call repeat logging or plan completion learning effectiveness.

## 10. Immediate development sequence

### Milestone 1: Make Today the Recall Sprint

**Scope:**

- add a dedicated Today/Sprint route and bounded task composer;
- compose 5–8 minute sessions from due, weak and recent evidence;
- reuse existing recall and assessment APIs;
- show one exact session summary and one primary Continue/Start action;
- preserve `/dashboard`, `/plan/today`, `/review` and `/recall/:id` deep links.

**Acceptance criteria:**

- a first-time learner can start a diagnosis from Today without creating a goal;
- the product defaults to 5–8 minutes;
- the selected session count and composition are explained;
- the session has a terminal "completed" or "needs more practice" state;
- unit/integration tests verify owner scope and duplicate submissions;
- Edge browser flow proves Sprint start, answer submission, repair/verification entry and reload.

**Implementation status — 2026-11-22**

- Implemented source-level.
- Added persisted, owner-scoped `recall_sprints` and `recall_sprint_items` records in migration `031_recall_sprints.sql`.
- Added authenticated `/api/sprints` create, active, read, complete, abandon, repair and verification routes.
- The Sprint composer uses up to two eligible due recalls, then a weak canonical concept, then a recent canonical concept, with a three-item ceiling and concept/deduplication checks.
- Sprint lifecycle is separate from submitted recall outcomes. Completion requires every diagnostic item to be submitted or skipped; a weak/unanswered Sprint can complete without implying mastery.
- Unit, disposable PostgreSQL integration and Edge browser smoke evidence passed for Sprint creation, idempotent resume, owner isolation, submission/reload and 1440/768/390 responsive layouts.
- Browser repair/verification remains implemented in existing remediation services but requires broader browser coverage beyond this milestone closeout.

### Milestone 2: Consolidate Library and simplify onboarding

**Scope:**

- merge material import/library and source-linked study under a Library destination;
- reduce the landing/new learner handoff to topic or material;
- move goal setup behind first diagnosis;
- merge catalog browsing and resource fallback behind subject-specific selection;
- make source limits visible and honest.

**Acceptance criteria:**

- a new learner reaches the first diagnosis in one primary action;
- no goal, roadmap or plan setup is mandatory;
- Library clearly distinguishes processed, processing, failed and scanned/no-text states;
- source-to-study and source-to-remediation actions retain ownership and return paths;
- responsive browser and accessibility checks cover Today, Library and first diagnosis.

### Milestone 3: Consolidate Progress and measure real retention

**Scope:**

- merge Learner rolling signal and My Readiness into one Progress destination with separate sections;
- show evidence history, Sprint history and due/verification trends;
- add activation and Sprint event telemetry with privacy-safe fields;
- create a bounded D1/D7/D28 cohort report;
- remove duplicate navigation that does not lead to Today, Library or Progress.

**Acceptance criteria:**

- Progress never conflates average rolling recall signal with canonical point readiness;
- unassessed and zero remain visually distinct;
- Sprint, verification and repair events have stable definitions;
- the privacy-safe event model is documented and tested;
- one real/cohort pilot can report activation and D1/D7/D28 return rates;
- no learning-effectiveness or mastery claim is inferred from event completion alone.

## 11. Ending summary

### Files inspected

Primary product and architecture documents:

- [README.md](/c:/Users/HP/RecallAI/README.md)
- [PROJECT_STATUS.md](/c:/Users/HP/RecallAI/docs/PROJECT_STATUS.md)
- [CORE_FEATURE_COMPLETION.md](/c:/Users/HP/RecallAI/docs/CORE_FEATURE_COMPLETION.md)
- [CORE_PRODUCT_COMPLETION_AUDIT.md](/c:/Users/HP/RecallAI/docs/CORE_PRODUCT_COMPLETION_AUDIT.md)
- [UX_JOURNEY.md](/c:/Users/HP/RecallAI/docs/UX_JOURNEY.md)
- [FRONTEND_DESIGN.md](/c:/Users/HP/RecallAI/docs/FRONTEND_DESIGN.md)
- [CORE_LEARNING_ROADMAP.md](/c:/Users/HP/RecallAI/docs/CORE_LEARNING_ROADMAP.md)
- [LEARNING_MODEL.md](/c:/Users/HP/RecallAI/docs/LEARNING_MODEL.md)
- [ADAPTIVE_LEARNING.md](/c:/Users/HP/RecallAI/docs/ADAPTIVE_LEARNING.md)

Frontend implementation inspected:

- [App.tsx](/c:/Users/HP/RecallAI/client/src/App.tsx)
- [Layout.tsx](/c:/Users/HP/RecallAI/client/src/components/Layout.tsx)
- [LandingPage.tsx](/c:/Users/HP/RecallAI/client/src/pages/LandingPage.tsx)
- [DashboardPage.tsx](/c:/Users/HP/RecallAI/client/src/pages/DashboardPage.tsx)
- [NewStudyPage.tsx](/c:/Users/HP/RecallAI/client/src/pages/NewStudyPage.tsx)
- [StudySessionPage.tsx](/c:/Users/HP/RecallAI/client/src/pages/StudySessionPage.tsx)
- [RecallPage.tsx](/c:/Users/HP/RecallAI/client/src/pages/RecallPage.tsx)
- [RecallResultPage.tsx](/c:/Users/HP/RecallAI/client/src/pages/RecallResultPage.tsx)
- [ReviewImprovePage.tsx](/c:/Users/HP/RecallAI/client/src/pages/ReviewImprovePage.tsx)
- [PlanPage.tsx](/c:/Users/HP/RecallAI/client/src/pages/PlanPage.tsx)
- [ReadinessPage.tsx](/c:/Users/HP/RecallAI/client/src/pages/ReadinessPage.tsx)
- [LearnerPage.tsx](/c:/Users/HP/RecallAI/client/src/pages/LearnerPage.tsx)
- [ResourcesPage.tsx](/c:/Users/HP/RecallAI/client/src/pages/ResourcesPage.tsx)
- [KnowledgePage.tsx](/c:/Users/HP/RecallAI/client/src/pages/KnowledgePage.tsx)
- [GroundedRemediationPage.tsx](/c:/Users/HP/RecallAI/client/src/pages/GroundedRemediationPage.tsx)
- [design-system.css](/c:/Users/HP/RecallAI/client/src/styles/design-system.css)
- [index.css](/c:/Users/HP/RecallAI/client/src/index.css)

Repository/package scripts and recent verification state were also inspected; no backend workflow beyond necessary route and policy reconciliation was modified.

### Repository state

- Branch: `main`
- Repository state: tracked branch is aligned with `origin/main`.
- Working tree at inspection: three documentation-only modifications in [README.md](/c:/Users/HP/RecallAI/README.md), [SESSION_LOG.md](/c:/Users/HP/RecallAI/docs/SESSION_LOG.md), and [RECALLLOOP_PERFORMANCE_BASELINE.md](/c:/Users/HP/RecallAI/docs/performance/RECALLLOOP_PERFORMANCE_BASELINE.md).
- Fresh validation in this session:
  - 49 unit test files passed;
  - 228 unit tests passed and 4 live-provider tests skipped;
  - server and client production builds passed;
  - configuration preflight passed for development providers;
  - `git diff --check` passed.

### Existing worktree changes preserved

No existing worktree change was modified. The only repository change made for this assignment is the addition of this strategy document.

### Important documentation inconsistencies

- [CORE_PRODUCT_COMPLETION_AUDIT.md](/c:/Users/HP/RecallAI/docs/CORE_PRODUCT_COMPLETION_AUDIT.md) contains an old 81% weighted-completion claim and old 138/150 question-bank counts. A later addendum marks several older claims superseded, but it still should not be read as current without [PROJECT_STATUS.md](/c:/Users/HP/RecallAI/docs/PROJECT_STATUS.md) and [CORE_FEATURE_COMPLETION.md](/c:/Users/HP/RecallAI/docs/CORE_FEATURE_COMPLETION.md).
- [UX_JOURNEY.md](/c:/Users/HP/RecallAI/docs/UX_JOURNEY.md) contains a 2026-10-19 snapshot that says the HTTP pilot awaits approval and was partly browser-blocked. Later 2026-11-01 and 2026-11-02 status entries report newer Edge/browser and bank evidence.
- [CORE_LEARNING_ROADMAP.md](/c:/Users/HP/RecallAI/docs/CORE_LEARNING_ROADMAP.md) describes the 24-item HTTP pilot as a current blocker in a dated Phase C entry. Later evidence reports 227 revisions and 186 eligible revisions.
- [ADAPTIVE_LEARNING.md](/c:/Users/HP/RecallAI/docs/ADAPTIVE_LEARNING.md) says resource ranking uses trust tier and freshness. Later status/docs say unsupported trust/freshness coverage claims were removed from resource recommendations. The two statements should be reconciled to reflect the current resource service.
- [PROJECT_STATUS.md](/c:/Users/HP/RecallAI/docs/PROJECT_STATUS.md) has both very early "IMPLEMENTED" rows and later high-confidence browser results. Present status should be evaluated from the latest dated entries, not by feature-count averaging.
- [CORE_FEATURE_COMPLETION.md](/c:/Users/HP/RecallAI/docs/CORE_FEATURE_COMPLETION.md) recorded a browser attempt for scheduler/plan changes that stopped because the isolated DB lacked the required DBMS blueprint. Earlier review browser journeys remain valid but do not validate the newest plan-task browser behavior.
- The CSS currently has overlapping base definitions in [index.css](/c:/Users/HP/RecallAI/client/src/index.css) and [design-system.css](/c:/Users/HP/RecallAI/client/src/styles/design-system.css); the second import supplies Aurora Ink overrides, but route-specific consolidation remains unfinished.

### Evidence limitations

- Implemented: code and data behavior exist.
- Tested: unit/integration suites or automated commands pass.
- Browser-verified: Edge/Playwright evidence exists for the named journey; it is not a claim for all routes or all error states.
- Historical: older Firefox and browser statements are leads, not proof of current behavior.
- Human-reviewed: zero current question approvals and zero human evaluator annotations.
- Live-provider quality: unmeasured and sometimes unavailable from this environment.
- Learning effectiveness: unmeasured in real student cohorts.
- Production readiness: unverified as a deployment certification.
- D1/D7/D28 retention: unmeasured.
- Hosted Firefox: not claimed as a fresh pass.

### Recommended next milestone

**Make Today the Recall Sprint.**

Build a single 5–8 minute session surface that uses existing due, weak and recent evidence, permits a first diagnosis before goal setup, and completes a repair/verification path. Keep acceptance centered on real browser/API/PostgreSQL behavior, owner isolation and reload persistence. Do not expand question-bank, provider, infrastructure or ingestion scope in the same milestone.

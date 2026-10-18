# Core learning roadmap

This plan sequences work needed to make the learning loop traceable from a learner's topic and material to evidence-backed next steps. Current implementation status is described in [Project Status](PROJECT_STATUS.md); roadmap items are not claims that the feature exists.

## Phase 1 findings: confirmed behavior and limits

| Reported symptom | Repository finding | Disposition |
|---|---|---|
| A YouTube URL appears as a topic/question | Confirmed: study title flowed into extraction, and empty material was allowed. The mock created generic points from the title; the LLM prompt explicitly allowed topic-only extraction. | New-session input rejects URL topics and URL-only material; source links remain separate. Extraction strips URL tokens and rejects extracted URL tokens in concept names, descriptions, and knowledge-point statements before session insertion. Remediation output also rejects URLs. A read-only scan of local `recallloop` found 4 historical URL-only sessions, 4 contaminated concepts and 20 contaminated question rows; 17 submitted attempts are attached. These records remain unchanged pending a data-preserving review. |
| Knowledge-point descriptions repeat | Exact repeated concepts/points are normalized within one extraction result and same-session persistence reuses matching concept names. The mock still derives points sentence by sentence, and personal points have no canonical IDs. Without the reported sample/session, the exact repeated display defect cannot be assigned to extraction versus legacy rows/rendering. | No legacy data was changed. This pass preserves current dedupe and adds a repeated-input integration regression; point identity/mapping and broader semantic dedupe remain in Phase B. |
| Mastery and counts contradict | Confirmed presentation inconsistency: the learner overview rendered `null` average mastery as `0%`, despite the service returning zero assessed concepts and null average. Baseline already deduplicated stable canonical point IDs, but a single correct point could still receive a “Strong” band. | Fixed learner empty state; baseline API now counts unique evidence and labels fewer than three assessed points “Early signal,” even when observed point coverage is 100%. Reports distinguish that point coverage from established concept mastery. |
| Questions are generic | Confirmed architecture: questions are deterministic built-in blueprints plus curated MCQs; the LLM provider is not used for question generation. Generic wording is a blueprint/content limitation, not evidence of live model quality. | Defined quality criteria and evaluator benchmark in Phase C; no unreviewed question bank generated here. |
| Resource details look unsupported | Confirmed: the recommendation explanation converted stored `coverage_strength` into a percentage and displayed numeric trust tier and freshness year without a documented calibration/source-verification rule. Duration is persisted as `estimated_minutes`, not a measured duration. | Removed percentage, trust-tier and freshness claims; retained source title/URL and catalog relationship, and label duration as an approximate catalog estimate. |
| End-to-end learning integrity is uncertain | Source shows connected study, extraction, recall, evaluation, learner-state, report and planner services. PostgreSQL tests exercise several slices, but source text extraction and live-provider/browser behavior have not yet had a complete manual trace. | No maturity claim. Phase A maturity requires a reviewed real-material trace and manual browser/provider evidence. |

## Phase A — Data and content integrity

**Learner problem:** A link can be mistaken for a topic, extraction can be synthetic or repetitive, reports can imply evidence where none exists, and resource rationale can overstate catalog metadata.

**Dependencies:** Existing study sessions, concept extraction, canonical catalog, assessment/evaluation, learner evidence, and resource catalog.

**Deliverables:** Keep topic, external source URL, and supplied text separate; reject URL-only sessions; preserve source provenance; validate extracted structures and retry safely; normalize exact duplicate concepts/points without merging merely similar concepts; preserve stable point IDs where a canonical mapping exists; align per-attempt evidence, unique-point counts, mastery bands, and empty states; present only supported resource claims; add provider diagnostics and regression tests.

**Acceptance:** A URL never becomes a topic/question; no concepts are generated without supplied or retrieved text; retries do not duplicate concepts in one session; a missing score is “Not assessed” while measured zero remains 0%; reports count unique assessed points; source URLs remain clickable; resource reasons can be traced to persisted relations/evidence.

**Automated tests:** URL/topic validation; source metadata roundtrip; extraction from supplied text and empty-input rejection; duplicate-label handling; unique assessed-point aggregation and null-vs-zero cases; existing structured and MCQ contracts; resource title/URL and rationale behavior; migration and ownership integration checks.

**Manual validation:** Create with a custom topic plus article/video link and pasted notes; try the link as topic and as the only material; run one successful and one failed extraction; compare an unassessed learner report with a real zero-evidence result; open a recommended source.

**Maturity evidence:** PostgreSQL-backed regressions pass on the current schema; no historical records are deleted; a reviewed sample of real study materials is traced to source, concepts, question, answer evidence, report and next action; live-provider and browser checks are recorded separately from mock coverage.

**Current delivery:** Topic/source separation, saved source URL, required text, URL-leak checks at input and structured extraction boundaries, URL rejection in generated remediation, no empty mock extraction, extraction-before-session persistence, learner empty-state correction, removal of unsupported resource trust/freshness/coverage-percent claims, and provider status check. Firefox E2E covers valid extraction with separate source provenance, URL-safe extracted content and prompts, plus URL-topic and URL-only-note rejection without orphan sessions. Baseline recovery/completion, Rapid Fire hints/submission/report, and grounded remediation citation/verification are also exercised in the browser. Live-provider material review and historical contamination review remain outstanding; historical records remain preserved pending evidence review.

## Phase B — Canonical knowledge and roadmaps

**Learner problem:** Catalog knowledge and personal extracted concepts are separate, so a custom study session does not reliably connect to a role or learning path.

**Dependencies:** Phase A data integrity; canonical catalog quality and provenance; stable identity migration design.

**Deliverables:** Role → topic → subtopic → concept → knowledge point navigation; clickable roadmap nodes; canonical-ID handoff to study and practice; custom-topic route that remains available; prerequisite edges; source provenance and explicit “unmapped” state; reviewed mappings from personal to canonical concepts and points.

**Acceptance:** Starting study or practice from a roadmap preserves canonical IDs end-to-end; a custom topic remains usable without a false canonical match; prerequisites are visible and traversable; every mapped point has a reviewed source and mapping status.

**Automated tests:** API contract and authorization tests for roadmap reads and handoffs; mapping uniqueness and prerequisite-cycle validation; persistence migration tests; custom and unmapped-topic cases.

**Manual validation:** Navigate one role from overview to leaf topic, start study, return to roadmap, and confirm the selected node and progress remain connected; test an unmapped custom topic and a prerequisite chain.

**Maturity evidence:** Curator-reviewed coverage for a bounded domain, mapping precision review, migration rollback/recovery plan, and observed completion of the roadmap-to-study flow.

**Current delivery (2026-10-11; browser trace verified 2026-10-17):** Additive migration `014` links a newly selected canonical topic/concept to a study session; extracted personal concepts map only when their name exactly matches the learner-selected canonical concept; canonical point IDs attach to recall evidence only for a unique normalized exact statement match in the selected concept. New Study suggestions preserve IDs; the authenticated roadmap returns role → skill → topic → concept → point data, direct prerequisites, catalog resources and user-scoped study/assessment status. Completed sessions show `Studied`; submitted recall/baseline evidence shows `Assessed`; no mastery is inferred from session completion. Custom free-text topics and unmatched/ambiguous point labels remain explicitly unmapped. Existing history is not backfilled. Firefox E2E now follows a canonical concept through study and submitted recall, verifies its mapped point evidence, unchanged canonical point count, and rendered roadmap identity. Phase B remains partial pending broader mapping-precision review.

## Phase C — Question quality

**Learner problem:** A valid question schema does not ensure a useful, answerable question, and current built-in prompts are often generic.

**Dependencies:** Phase B stable concept/point IDs and Phase A traceable source text; licensed/curated content policy.

**Deliverables:** A manageable curated question bank with verified answers; explicit objective, required answer ideas, misconception, blueprint, reference answer and rubric; misconception-driven distractors; optional real-provider generation constrained by source and schema; attribution/licence metadata; semantic deduplication and quality gates; structured and interactive response modes.

**Acceptance:** Each question maps to a canonical point and objective, includes a reviewed key/rubric and source attribution, has a supported licence, and passes answerability, ambiguity, duplication and relevance checks. Generated items remain drafts until reviewed; no arbitrary 1,000-item batch is used as a quality proxy.

**Automated tests:** Blueprint/schema validation; question-to-point mapping; key/distractor checks; semantic duplicate candidates; provider timeout/invalid output/retry behavior; deterministic mock fixtures; licensing metadata requirements.

**Manual validation:** Experts answer a stratified sample without seeing keys, flag ambiguity and unsupported premises, and inspect generated distractors and source attribution.

**Maturity evidence:** Versioned labeled evaluation set, reviewer agreement and release thresholds, measured defect rates, and documented item provenance.

**Current delivery (2026-10-18, partial):** Migration `016` and the [canonical question bank design](CANONICAL_QUESTION_BANK.md) provide stable identities, immutable revisions, exact canonical point mapping, source provenance, review/publication gates, offline quality validation, benchmark fixtures, and a vertical slice through existing assessment/recall persistence. The original pilot has 24 items across the two actual HTTP canonical points. It is engineering-reviewed and RFC-grounded; independent subject-matter review, blinded answerability review, human-labeled evaluator results, reviewer agreement, and release thresholds are not yet established. Expand only after that review.

## Phase D — Evaluation and session reports

**Learner problem:** Learners need feedback tied to answer evidence and a useful report, not a single score that obscures partial or missing ideas.

**Dependencies:** Phase C reviewed objectives and answer rubrics; Phase B stable knowledge-point identity.

**Deliverables:** Per-question feedback; answer-key/explanation reveal after submission; correct/partial/missing/incorrect distinctions; unique knowledge-point evidence; single-write recoverable baseline and recall submissions; coherent study-session and assessment reports; a labeled evaluator benchmark of manageable size. My Readiness selects direct latest submitted canonical point evidence and displays partial, incorrect, unanswered, and absent results separately from blended learner mastery (ADR 010).

**Acceptance:** Each shown result traces to submitted content and rubric; unassessed dimensions remain absent; independent structured parts remain independent; aggregates state their denominator and do not imply long-term mastery from one answer.

**Automated tests:** Offline scripted evaluator fixtures cover adequate, partial, misconception, vague, terminology error, irrelevant, and prompt-injection-shaped answers, plus malformed/schema-invalid output, strict point mapping, and blank structured parts. These validate contract behavior only; they do not score model accuracy. PostgreSQL tests cover latest evidence selection, timestamp tie-breaks, answer-state classification, unmapped skills, owner checks, and disagreement with stale blended mastery. Keep denominator/count tests, human review, and calibrated quality thresholds as separate requirements.

**Manual validation:** Compare evaluator output to human labels across correct, incomplete, incorrect, irrelevant and adversarial answers; inspect the learner explanation and next action.

**Maturity evidence:** Benchmark results with error analysis and inter-rater notes; monitored regression set; review of real reports for clarity and consistency.
**Current delivery (2026-10-17):** Assessment reports expose outcome counts, point-level feedback and maturity status; Firefox verified the rendered report against the API summary. Baseline duplicate/lost-response recovery, completion and atomic learner-state updates have PostgreSQL and browser regressions, including a forced rollback case. Recall review intervals now round to whole days to match the persisted integer schema; the browser trace found and verified the prior fractional-interval failure. The offline evaluator contract benchmark is implemented, while human-labeled model-quality benchmarking and review remain open.

## Phase E — Resources and remediation

**Learner problem:** Catalog recommendations may be weakly sourced, and remediation must remain grounded in material the system actually has.

**Dependencies:** Phase A truthful metadata; Phase B canonical mappings; Phase D stable, point-level gaps.

**Deliverables:** Attributed resource hub with title, URL, type, provider, licence and provenance; recommendation rationale tied to catalog links and observed gaps; source-backed remediation and citations; targeted verification; broken-source detection and fallback behavior.

**Acceptance:** Every link opens its recorded source; unknown metadata remains unknown; no uncalibrated trust/freshness/coverage percentages are asserted; generated remediation claims are supported by retrieved excerpts; verification measures a new attempt and does not assert improvement in advance.

**Automated tests:** Metadata roundtrip, URL safety, retrieval/citation integrity, unsupported-claim handling, missing source and provider failures, fallback selection, and verification linkage.

**Manual validation:** Open sources, inspect attribution/licence, compare remediation claims to cited excerpts, simulate unavailable sources, then complete targeted verification.

**Maturity evidence:** Curator-reviewed source set, provenance audit, retrieval-grounding benchmark and broken-link monitoring.
**Current delivery (2026-10-17):** User-provided source ingestion, scoped retrieval, validated grounded remediation generation and targeted verification are implemented and PostgreSQL-tested. Firefox verified displayed explanation/key ideas, the original source URL citation, and a completed targeted recall that marks the remediation verified with improved evidence. Manual comparison of claims to sources, provider-quality review, and broken-source behavior remain open.

## Phase F — Planner and UX

**Learner problem:** Roadmap, study, practice, plan changes and completion state need to feel like one coherent learner-controlled workflow.

**Dependencies:** Phases B through E provide stable nodes, useful questions, evidence and resources.

**Deliverables:** Connected roadmap-to-study planner; controlled plan edits; session status and revisit preferences; day/week calendar; next-step rationale and source links; clear recovery from incomplete sessions and provider failures.

**Acceptance:** Every task points to a valid learning action and its source evidence; learner edits persist; plans respect available time and task state; incomplete or failed work is recoverable without duplicate evidence.

**Automated tests:** Planner constraints, state transitions, task/resource links, authorization, rescheduling and idempotent retry paths.

**Manual validation:** Build a weekly plan, alter availability, complete and miss tasks, revisit a session, and follow next-step links from a report.

**Maturity evidence:** Usability sessions across novice and experienced learners, task completion/error measures, and evidence that plan reasons match the underlying state.

**Current delivery (2026-10-17):** Firefox verifies the resource handoff and safe no-match state, canonical roadmap-to-study evidence, and daily-plan due recall with complete/skip/overdue persistence. Planner day boundaries use UTC consistently because no user time-zone preference exists. My Readiness uses deterministic latest submitted canonical point results and keeps correct, partial, incorrect, unanswered, and no submitted evidence distinct. The integration test covers classifications and tie-breaks; usability and broader mapping precision remain unmeasured.

## Later roadmap

- **FSRS:** Evaluate a mature spaced-repetition scheduler only after evidence quality and outcome calibration are stable; compare against current deterministic scheduling on a replayable dataset.
- **Advanced RAG / pgvector:** Consider indexed retrieval when corpus size and measured latency justify it; retain provenance and compare retrieval against labeled relevant excerpts.
- **Practice engine:** Add richer coding, simulation and application tasks after question objectives and evaluation benchmarks are dependable.
- **ForkSpace integration:** Define a documented integration boundary and consent/data-minimization model before connecting learner artifacts.
- **Redis / BullMQ:** Add background jobs when measured provider latency or ingestion volume requires asynchronous processing; define retry/idempotency and dead-letter behavior.
- **Observability:** Add privacy-conscious traces for provider, extraction, evaluation, retrieval and planner failures with redaction rules and actionable operational measures.
- **Security hardening:** Review authentication, secret handling, data export/deletion, rate limits, URL handling, tenant isolation and dependency posture before external deployment.
- **Learning Coach:** Build only on evidence-linked actions and make uncertainty and source provenance visible.
- **MCP:** Expose a narrow, authenticated tool surface after stable APIs, ownership checks and audit behavior are established.

Each later item needs a measurable problem statement and acceptance evidence before implementation; its inclusion here is not a commitment to a particular technology.

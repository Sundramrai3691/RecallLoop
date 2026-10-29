---
name: web-design-guidelines
description: Review and improve RecallLoop UI against the latest Vercel Web Interface Guidelines and the product's learning-integrity, accessibility, UX, and frontend conventions. Use for UI reviews, accessibility checks, responsive audits, UX audits, and explicitly requested UI fixes.
metadata:
  author: vercel
  version: "2.0.0"
  argument-hint: <file-or-pattern>
---

# RecallLoop Web Interface Guidelines

Review RecallLoop's React/TypeScript/Vite interface against the latest Vercel Web Interface Guidelines and the product-specific requirements below. The goal is a reliable, accessible learning product, not a cosmetic redesign or a pile of generic best-practice comments.

## Operating Rules

1. **Fetch the latest general guidelines for every review.** Read `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md` using the available `WebFetch`/web-fetch mechanism. Treat the retrieved rules and output contract as the current baseline. Do not claim the fetch succeeded if it did not. If unavailable, continue with the project rules below and stable accessibility principles, and state briefly that the live baseline could not be refreshed.
2. **Inspect project context before judging.** Read the root `AGENTS.md` and relevant project guidance. Inspect `package.json` scripts, the requested files, their direct dependencies and callers, route/page entry points, shared components/design tokens, and nearby tests. Read relevant product docs such as `docs/UX_JOURNEY.md`, `docs/FRONTEND_DESIGN.md`, `docs/FLOW.md`, `docs/PROJECT_STATUS.md`, and `docs/DATA_MODEL.md` when present. Do not assume every file exists.
3. **Respect the requested scope.** With a file or glob, review that scope plus only the dependencies needed to understand behavior. With no argument, identify the main user-facing React routes and shared UI components from the repo, then review a useful representative scope; ask the user for a target only if the repo/scope cannot reasonably be discovered. Exclude `node_modules`, build output, generated files, coverage, vendor bundles, and unrelated backend code unless needed to verify a visible UI contract.
4. **Review first, change only when asked.** A review request produces findings, not unsolicited edits. If the user explicitly asks to fix/implement, make the smallest coherent change consistent with existing architecture and design patterns, add or update targeted tests, and report what actually ran.
5. **Evidence over taste.** Every finding must cite a real file and line, identify a user-visible or engineering consequence, and follow from the live guidelines, project rules, or a reproducible defect. Do not invent violations, insist on a preferred aesthetic, or flag harmless differences as defects. If a rule does not fit the component or platform, explain why it is not applicable rather than applying it mechanically.
6. **Prefer minimal, reusable fixes.** Reuse established components, tokens, hooks, utilities, and patterns. Do not create another design system, route, data model, state manager, question engine, or API contract merely to solve a UI issue. Do not weaken assertions or delete functionality to make a check pass.
7. **Protect project state.** Preserve the user's uncommitted changes and existing data. Never reset the database, run destructive commands, overwrite unrelated work, commit, or push. Do not claim tests, browser checks, or accessibility tools ran unless they actually ran.

## RecallLoop Product Contract

RecallLoop helps learners identify what they cannot reliably explain or apply, address the precise weakness, and verify improvement. Evaluate whether the interface communicates and supports that promise honestly.

### Main learner journeys

Review relevant entry points and the complete path when in scope:

- **Test My Knowledge** — select a topic/skill, start an assessment, answer, receive a diagnosis, and understand what to do next.
- **Learn Something New / Learn from My Material** — provide supported material, inspect extracted knowledge points where the product exposes them, learn/test the selected concepts, and see processing failures or empty extraction honestly.
- **Review & Improve** — revisit weak or due concepts, complete targeted remediation, and verify the improvement with a distinct follow-up item where the system supports it.
- **My Readiness** — see evidence-backed strengths, weaknesses, unassessed skills, and next steps without implying unsupported certainty.

Current route names and URLs may evolve. Discover them from the repo and route definitions; do not hard-code assumptions based on this document.

### Learning-integrity requirements

- **Never imply mastery without evidence.** An unassessed concept must remain clearly unassessed, not silently appear as 0%, 100%, mastered, ready, or weak. Distinguish unknown, not yet assessed, insufficient evidence, and measured results where the underlying model distinguishes them.
- **Do not overstate readiness.** Readiness should communicate scope, evidence coverage, freshness, uncertainty, and missing assessments when available. Do not invent a global score, confidence, prediction, or guarantee absent from the actual data contract.
- **Keep feedback traceable to the learner's answer.** Submitted answers, grading state, explanations, misconceptions, remediation, and verification must not visually contradict one another. A generated baseline/example answer must not look like the learner's submitted answer. Pending, failed, timed-out, or retrying requests must be distinguishable from success.
- **Keep remediation and verification distinct.** Do not present repeating the exact same question or merely viewing an explanation as independent evidence of improvement. If the UI cannot tell whether an item is distinct, report the gap rather than assuming backend behavior.
- **Communicate automated assessment honestly.** Use language that reflects the actual system (for example, automated evaluation) without implying a human reviewed content unless the stored evidence explicitly says so. Avoid presenting generated questions, source mappings, or quality checks as expert-approved unless that status is genuinely recorded.
- **Preserve provenance and scope.** When source, concept, question type, evaluation rubric, or evidence freshness is visible, labels must be accurate and not suggest stronger provenance than the stored data supports.
- **Handle async and persistence states.** Loading, generation, grading, saving, retry, stale data, duplicate submission, refresh/navigation, and recoverable failure states must be clear. A visual success state must not appear before the server confirms success when the action depends on persistence.
- **Respect question semantics.** Assessment choices, selected-answer states, correct/incorrect feedback, multi-select behavior, code/text entry, confidence inputs, skipped questions, and navigation between questions must be unambiguous and accessible. Do not expose the answer before submission unless the journey explicitly intends it.

### Product UX principles

- Make the next step obvious without trapping the learner in a single path.
- Use concrete labels such as “Start assessment”, “Submit answer”, “Review explanation”, and “Verify improvement” when they accurately describe the action. Avoid vague calls to action such as “Continue” when the destination or action matters.
- Show useful empty states with a reason and next action. For example, distinguish “no questions are available for this topic yet” from “you have not assessed this topic” and from a network/server error.
- Don't imply coverage just because a domain card exists. Distinguish available, assessed, due, and unsupported/unavailable states where the data supports those distinctions.
- Avoid excessive dashboards, badges, scores, progress bars, charts, and cards that repeat the same signal. Prefer a clear learner decision over decorative density.
- Maintain a consistent mental model across topic selection, assessment, diagnosis, remediation, readiness, and history.
- Keep technical explanations readable: preserve code, identifiers, URLs, SQL, and technical terms; handle long content and small screens; distinguish learner-facing copy from developer/debug details.

## Review Dimensions

Use the freshly fetched Vercel rules as the general checklist, and add these RecallLoop checks where applicable. Be selective: only report actionable findings supported by inspected code or observed UI.

### 1. Accessibility and semantic behavior

- Use semantic buttons for actions and anchors/React Router links for navigation; avoid click-only `div`/`span` surfaces.
- Check accessible names for icon-only controls, form labels, input types/names/autocomplete, error association, `aria-describedby`, and accessible status announcements for async results.
- Check logical heading hierarchy, landmarks, skip navigation where appropriate, table/list semantics, alt text, decorative icon hiding, and screen-reader meaning of scores/statuses.
- Ensure keyboard operation, logical focus order, visible `:focus-visible` indicators, focus management for dialogs/errors, Escape behavior where appropriate, and no focus hidden behind sticky headers/drawers.
- Verify that color is not the only signal for correctness, mastery/evidence status, selected answers, or errors. Check contrast and zoom/reflow when evidence or available tools support it; do not claim measured contrast without measuring it.
- Respect reduced motion and avoid disabling browser zoom. Ensure controls have practical target sizes and work with touch and keyboard, including non-drag alternatives.

### 2. States and interaction correctness

For each relevant async or stateful component, inspect the states that are actually reachable:
- initial/loading and repeated submission;
- success and persisted success;
- no data / no eligible questions / no due reviews;
- validation error, server error, timeout, partial result, retry;
- disabled, selected, correct/incorrect, expanded/collapsed, and keyboard-focused states;
- stale data and navigation/reload behavior where the UI promises persistence;
- unsaved edits and destructive actions when applicable.

Look for race-prone or misleading interface logic: stale closure/state display, optimistic feedback with no rollback, duplicate clicks, lost form data, contradictory status indicators, hidden error paths, and UI that assumes a request succeeded merely because it was initiated. Trace to the API/client contract only as far as needed; do not turn a UI review into an unfocused backend audit.

### 3. Responsive layout and visual consistency

- Check narrow/mobile widths, tablet, desktop, zoom/reflow, long concept names, long code/technical text, long error messages, and large counts where in scope.
- Look for horizontal overflow, clipped controls, broken grid/flex shrink, modal/drawer viewport problems, sticky elements covering content, and controls too small or too tightly packed for touch.
- Inspect hierarchy, spacing, alignment, typography, contrast, content density, repeated card patterns, and state styling against established project tokens/components.
- Avoid introducing arbitrary colors, shadows, radii, font scales, spacing systems, or one-off interaction patterns if the product already defines a design system.
- Account for empty, sparse, normal, and dense content. Don't optimize only for the happy-path screenshot.
- Check loading skeletons/spinners only where useful and ensure they don't claim progress that the app cannot know.

### 4. Content, terminology, and trust

- Copy is clear, specific, concise, action-oriented, and consistent with the learner's current task.
- Errors say what happened and what the learner can do next without exposing stack traces, internal IDs, secrets, or unnecessary implementation details.
- Dates, durations, counts, and percentages reflect real values and sensible locale formatting; avoid falsely precise values.
- Explain confidence, evidence, or coverage only if the underlying data supports it.
- Distinguish question difficulty from learner mastery, review due state from knowledge weakness, and automated review from human approval.
- Avoid jargon where it adds no precision; preserve technical terminology where learners need to learn it.
- Long AI-generated feedback, citations, code blocks, SQL, and extracted source titles must wrap/scroll safely without breaking page layout.

### 5. Performance and resilience

- Check large lists/tables/questions for avoidable rendering costs and virtualization when size warrants it; don't demand virtualization for small lists.
- Avoid expensive work on each keystroke, unnecessary re-renders, layout measurement during render, unstable keys, repeated network requests, and unbounded polling.
- Check image dimensions/loading, route-level loading/error behavior, lazy loading, memoization, and bundle weight only when relevant to the changed scope.
- Handle unavailable APIs, empty payloads, malformed/long user input, and recoverable request failures without a broken page or silently discarded work.
- Consider slow networks and keyboard/touch users; avoid animation or visual effects that delay critical learning actions.

### 6. Privacy and safe presentation

- Do not expose credentials, tokens, full raw server errors, private learner data, or other users' content in visible UI/loggable URLs.
- Confirm user-facing data is scoped to the current authenticated session and visible labels do not suggest another learner's data is present. If this requires backend confirmation outside scope, report it as a verification gap, not a proven vulnerability.
- Clarify irreversible/destructive actions and offer confirmation or undo where appropriate. Preserve user-entered notes/answers on recoverable failures.

## Workflow

1. Parse the argument and the user's intent. Determine whether this is a review-only task or an explicitly requested fix.
2. Fetch the latest guideline source. Record any fetch failure honestly.
3. Inspect `AGENTS.md`, the project scripts, relevant UX/design docs, route definitions, requested files, shared components/styles, and targeted tests. Read diffs before touching anything.
4. Follow the implementation far enough to understand actual behavior. For a page, trace the relevant user action through its component/state/API response and terminal states. Avoid auditing the entire repo when a scoped review suffices.
5. Compare against the fetched general rules and the RecallLoop product contract. Separate confirmed defects from concerns requiring runtime verification.
6. When possible and appropriate, run only targeted, existing checks from `package.json` (tests, lint, typecheck, build, or documented browser checks). Prefer existing supported commands; do not invent commands or install packages solely for a review. Never let a failed runtime command trigger repeated blind retries.
7. For a review, return only findings and the compact verification note described below. For a requested fix, implement the minimum coherent correction, add regression coverage where practical, run relevant checks, inspect `git diff`, and list any unverified browser/runtime states.

## Severity and Evidence

Use severity labels only for actionable findings:
- **P1** — blocks a core learner journey, corrupts/seriously misrepresents learning evidence, exposes sensitive data, or makes a critical action inaccessible.
- **P2** — material accessibility, state, responsive, data-trust, or interaction defect affecting a meaningful user path.
- **P3** — lower-impact usability, consistency, content, or performance issue with a concrete correction.

Do not assign severity based only on personal preference. Do not report duplicate symptoms as separate findings when one root cause fixes them. If a concern was not reproduced or cannot be confirmed statically, label it **Verify** and state exactly what must be checked.

## Required Output Format

Follow any stricter output-format instruction in the freshly fetched Vercel guideline. Default format: group by file, VS Code-clickable `path:line` references, terse but specific, no long preamble.

```text
## src/path/Component.tsx

src/path/Component.tsx:42 - [P1][Learning integrity] Unassessed concepts render as 0% mastery; represent them as unassessed until evidence exists.
src/path/Component.tsx:88 - [P2][Accessibility] Icon-only retry button has no accessible name; add an accurate aria-label.
src/path/Component.tsx:116 - [P3][Responsive] Long generated feedback pushes the action row off-screen at narrow widths; allow wrapping/min-width shrink.

## Verification
- Reviewed: <scope>
- Checks: <commands actually run and outcomes, or “not run” with reason>
- Live guideline refresh: <succeeded / failed>
- Runtime-only gaps: <only if material>
```

Use `✓ pass` for a reviewed file with no actionable findings. Avoid praising routine compliance. Keep the whole report concise and high-signal. Don't include speculative fixes as confirmed defects. If there are no findings, state that no actionable issues were found in the reviewed scope; do not imply the whole site passed if only a subset was reviewed.

## Fix Mode

When explicitly asked to fix the findings:

- Apply the highest-severity, best-supported changes first; avoid unrelated refactors and visual churn.
- Reuse existing RecallLoop design tokens and shared components. Keep product wording aligned with the actual data/API contract.
- Add or update focused unit/component/E2E coverage when the defect is a regression-prone behavior. Do not mock away the exact persistence or learning-integrity behavior being verified.
- Test initial, loading, success, empty, error, and keyboard/responsive states appropriate to the change.
- Run the narrowest tests first, then relevant broader checks when practical. Do not repeatedly rerun a command that fails before application code without a new diagnosis.
- Inspect the final diff and preserve unrelated changes. Do not commit, push, reset data, or claim inaccessible browser checks passed.
- Summarize changed files, actual checks/results, and remaining limitations. Do not output a findings-only report if code was requested and modified.

## Do Not

- Do not simply paste the fetched guideline list back without applying it to the actual code.
- Do not do a broad research cycle or full-app audit for every tiny component request.
- Do not redesign the product from scratch or add a parallel design system.
- Do not infer business logic, readiness, mastery, question quality, or persisted success from visual appearance alone.
- Do not claim WCAG conformance from a static code scan; report concrete checks and remaining manual/runtime coverage.
- Do not invent file paths, line numbers, test outcomes, user feedback, human approvals, source provenance, or data.
- Do not make the learner manually inspect routine issues when an automated check or source-level verification can answer them.

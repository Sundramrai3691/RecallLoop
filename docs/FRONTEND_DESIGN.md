# RecallLoop Frontend Design

## Direction

RecallLoop uses **Aurora Ink**: a focused, contemporary interface with deep ink surfaces, soft violet as the navigation/action color, and citron as a small highlight. The visual hierarchy should make the next useful learning step clear, then let evidence explain why it is suggested. The UI uses the existing API data and does not invent activity, content coverage, or learner progress.

The shared tokens and responsive overrides live in `client/src/styles/design-system.css`; the existing semantic component rules remain in `client/src/index.css`. Components should use those tokens instead of introducing route-specific colors.

## Color and theme

- Dark canvas: `#0B1020`; surfaces use layered midnight blue tones.
- Light mode uses a cool near-white canvas and clean white surfaces.
- Text uses high-contrast near-white/ink and muted slate for secondary information.
- Violet (`#9B8CFF`) marks navigation, focus and primary learning actions.
- Citron (`#D7FB7B`) is reserved for small illustrative accents, not long text or large surfaces.
- Success, warning and error use distinct semantic colors and surface tokens. Any state visualization also includes a text label.

Theme selection remains a persistent light/dark preference in `ThemeProvider`, with system preference as the initial fallback. No downloaded font is required; the UI uses local system sans-serif fonts.

## Navigation and motion

The desktop shell groups Dashboard, New study, Today's plan, Goals, Knowledge, Resources, Learner, and Settings. Mobile navigation keeps text with its icons and makes room for the bottom safe area. A skip link provides a direct path to the main content. Product routes, action destinations, recovery states, and E2E mapping are maintained in [Product flow and UX journey audit](UX_JOURNEY.md).

Route changes use a brief opacity and 5px vertical transition. Motion for React is configured with `reducedMotion="user"`; decorative constellation drawing and card entrances also honor `useReducedMotion`. Avoid continuous animation, parallax, and motion that obscures answer or evidence state. CSS transitions remain short and are disabled by the existing reduced-motion media query.

## Landing page

The landing page presents the learning loop as Learn → Recall → Evaluate → Adapt. Its Knowledge Constellation is an SVG illustration of the product process, not a claim about catalog coverage or user progress. Do not add customer counts, testimonials, proficiency claims, or unsupported topic lists without evidence.

## Dashboard hierarchy

Home selects one primary action from persisted learner state: first goal, due recall, in-progress study, planned task, weak concept practice, or study something new for an active goal. First-visit Home keeps the initial goal action clear; returning learners can still reach goal, plan, and evidence summaries below the primary action. Values and labels should retain their denominators and reflect API fields. Historical URL-shaped titles use a neutral fallback in headlines; saved source links stay available as separate links.

## Learning evidence

My Learner labels the aggregate as **Average recall signal**. It is an equal average of each assessed personal concept's rolling `mastery` value. Each submitted recall updates that concept score using 60% current coverage and 40% of its previous score. This is not the percentage of knowledge points mastered and should not be labeled as stable mastery. Per-concept status/progress uses the persisted concept score and stays separate from My Readiness, which uses latest submitted canonical point results.

Goals with the same trimmed, case-insensitive title are distinct existing records and remain visible. New exact-title duplicates are rejected within the authenticated learner's workspace; similar but non-identical goals are left alone. The UI must not silently merge or delete saved goals.

## Component conventions

Use bordered surfaces with 15–20px radii, compact status chips, readable body copy, and one clear primary action per section. Keep empty states short and pair them with a supported next action. Avoid oversized panels that push the principal action below the fold. Use Lucide icons consistently and include visible labels for navigation.

## Knowledge map and catalog

Role maps use the real catalog hierarchy: role, skill, topic, concept, knowledge point. Display only persisted prerequisites, resources, and learner evidence. A decorative visual may illustrate relationships only when edges are backed by catalog data; the landing illustration is explicitly process-oriented and makes no catalog relationship claims.

## Accessibility and responsive behavior

Use semantic links and buttons, visible violet focus rings, explicit form labels, sufficient text contrast, accessible names for icon-only controls, and text labels alongside semantic colors. Keep one primary action per section; disclose alternatives and give status-changing controls distinct verbs. The shell adapts at tablet/mobile breakpoints; cards stack, action rows wrap, the mobile navigation includes safe-area padding, and no screen should require horizontal scrolling at 390px. The E2E browser matrix checks 1440×900, 768×1024, and 390×844 in a browser that honors exact CSS viewport sizing.

## Charts and metrics

Only chart API-supplied values. State the population or denominator, distinguish `null`/not assessed from measured zero, and show an explanatory empty state when data is insufficient. Use a progress bar only for a defined measure; do not synthesize daily history or imply calibration from display precision.

## Why this?

Tie recommendation explanations to available fields such as due state, prior coverage, weakness, or goal relevance. If the API does not provide a reason, keep the explanation minimal rather than implying one.

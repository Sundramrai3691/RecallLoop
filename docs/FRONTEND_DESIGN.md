# RecallLoop Frontend Design

## Design Philosophy

RecallLoop uses a calm, editorial interface for deliberate learning. The experience should make the next learning action clear, explain recommendations only with available evidence, and keep learner-state information secondary to action. Use real API data; do not fabricate analytics or recommendation reasons.

## Color Tokens

Global colors are defined in `client/src/index.css` and shared through CSS variables. Light mode uses a near-white canvas, white surfaces, warm ink, and a restrained burnt-orange accent. Dark mode uses the requested charcoal surfaces and a lighter orange accent. Weak, developing, and strong mastery each have distinct semantic tokens; every mastery visualization must also show a text label.

## Typography

Fraunces is used for headings and prominent statistics. IBM Plex Sans is used for body copy and controls. The scale is 13px for metadata, 15px for standard UI, 19-24px for compact headings, and 40px for hero statistics. Keep letter spacing neutral and reserve display sizes for primary values.

## Navigation

The shared app shell uses compact Lucide icons with text labels for Dashboard, New study, Goals, Today's plan, Learner, and Knowledge. The active route uses the accent tint. A theme control sits beside navigation, and the navigation wraps into a three-column layout at tablet and mobile widths.

## Dashboard Hierarchy

The dashboard should lead with the next recall and its data-supported rationale, then show today's plan and active goal, followed by compact learner and activity context. Avoid equal-weight analytics cards. Daily activity visualizations require daily counts from the API; do not synthesize missing history.

## Component Conventions

Use 12px-radius bordered surface cards, 12px-radius controls, clear primary and secondary buttons, and the shared CSS tokens. Reserve hover elevation for interactive elements. Keep empty states brief and pair them with an appropriate action when the API and routes support one.

## Accessibility

Use semantic links and buttons, visible accent focus rings, explicit form labels, sufficient contrast, accessible names for icon-only controls, and text labels alongside semantic colors. Respect reduced-motion preferences.

## Responsive Behavior

The shell is fluid up to a constrained desktop width. Navigation becomes a three-column grid on smaller viewports, content grids use responsive minimum tracks, and action rows wrap rather than overflow. Verify narrow mobile widths as screens are redesigned.

## Chart Rules

Only visualize values supplied by the API. Use the smallest appropriate chart implementation, include accessible text labels, and show an explanatory empty state when data is insufficient. Do not add synthetic calibration points or progress values.

## Why This?

Keep recommendation rationale compact and tied to available fields such as due state, prior coverage, weakness, or goal relevance. If the API does not provide a reason, keep the explanation minimal and document the missing field instead of implying a reason.

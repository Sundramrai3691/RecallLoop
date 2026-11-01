# Adjudication guide

1. Wait until two independently submitted current annotations exist for the exact case/revision/hash.
2. The adjudicator must have relevant domain expertise, must not be either annotator, and must not see the provisional label or model output before making an independent decision.
3. Compare question validity, canonical mapping, reference-answer validity, rubric completeness, classification, explanations, missing concepts, and confidence. Preserve disagreement; do not average labels.
4. Submit an append-only adjudication citing both current annotation IDs. Record decision (`correct`, `partial`, `incorrect`, `unscorable`, or `reject_question`), all four quality decisions, rationale, confidence, expertise, pseudonymous code, and timestamp.
5. A valid classification resolves the label only if the question and mapping are valid, reference answer valid, rubric complete, and decision is scorable. Otherwise mark rejected due to defect and exclude from scoring.
6. If the adjudication itself needs correction, append a new adjudication version referencing the prior ID. Never overwrite prior evidence.

The generated report shows current reviewer annotations, full annotation history, adjudication history, provisional label comparison, status, and scoring eligibility. Agreement and adjudication are review outcomes, not independent proof of truth. No agreement statistic is produced until real independent annotations are available and a suitable complete sample exists.

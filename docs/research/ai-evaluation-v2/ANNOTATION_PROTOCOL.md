# AI evaluator benchmark v2 annotation protocol

## Purpose and blinding

This protocol establishes human labels for the separate v2 copy of the 35 synthetic v1 cases. It does not grant production question-bank approval. Each reviewer receives one domain pack and must not see the v1 review pack, provisional label/rationale, model output, or another reviewer's response before their own submission is locked. The shared packs contain question/revision identity, canonical mapping, answer contract, rubric, and synthetic response only. Reviewers must use pseudonymous codes; identity-to-code mapping stays outside this repository.

## Per-case contract

Record all fields in `annotation-schema.json`: exact case/revision/hash; pseudonymous reviewer code; relevant domain expertise; question validity (`valid`, `ambiguous`, `incorrect`); mapping validity (`valid`, `invalid`); reference-answer validity (`valid`, `incomplete`, `incorrect`); rubric completeness (`complete`, `incomplete`, `incorrect`); classification (`correct`, `partial`, `incorrect`, `unscorable`); technical explanation; essential missing concepts; confidence; ISO 8601 review time; and optional suggested correction. `unscorable` is required when the prompt, mapping, reference answer, rubric, or response cannot support a defensible classification.

- **Correct:** satisfies essential rubric requirements without material technical error.
- **Partial:** relevant correct reasoning is present, but an essential requirement is missing or misunderstood.
- **Incorrect:** fails to demonstrate the required knowledge or contains a material technical error.
- **Unscorable:** a defect or ambiguity prevents a defensible judgment.

Assess question and mapping validity separately from the answer label. State the technical reason, not just the selected class. Proposed corrections are suggestions only; do not edit immutable source revisions.

## Independence and expertise

Two reviewers with relevant domain expertise annotate each case independently. They must not coordinate, view each other's work, or view provisional labels before submission. Use distinct pseudonymous reviewer codes. The designated coordinator checks that codes map to distinct people without publishing names or the identity map. This repository cannot independently prove a person's identity or credentials; expertise statements and coordinator verification are process evidence supplied by the review organizers, not automated facts.

Import each submission through the dry-run CLI. Review validation errors with the submitting reviewer, preserve the original submission, and apply only a corrected new annotation version that names the superseded annotation. Never edit or delete prior ledger rows. The utility rejects duplicate IDs and stale revision/hash references.

## Eligibility for benchmark scoring

No current case has a human label. A case is not human-scoring eligible until it has two current independent annotations, both agree on a class, both mark question/mapping/reference/rubric acceptable, and neither calls it unscorable. Any disagreement or quality concern requires a third independent adjudicator. The adjudicator must cite the two current annotation IDs, be distinct from both reviewers, record all quality judgments, classification or rejection, rationale, confidence, and timestamp. A rejected/ambiguous/unscorable case remains excluded.

Agreement is not proof of technical correctness. Reports retain both explanations and any adjudication. Do not compute inter-rater agreement with fewer than two submitted independent labels per case, placeholders, or provisional labels. Do not compute model accuracy until valid live model outputs and eligible adjudicated labels exist. v1 remains unchanged and its proposed labels remain provisional.

## CLI

From repository root, preflight (no write):

```powershell
npm.cmd run benchmark:annotations -w server -- --in <submission.json> --kind annotations
```

Append only after preflight:

```powershell
npm.cmd run benchmark:annotations -w server -- --in <submission.json> --kind annotations --apply
```

Use `--kind adjudications` for adjudicator records. The ledger and adjudication report are version-controlled JSON under this directory. The import utility does not connect to PostgreSQL, call a provider, or access learner records. Keep raw contact details and the pseudonym key outside the repository.

# AI evaluator benchmark v2 review status

Snapshot: 2026-11-01. The v2 dataset contains 35 cases; all 35 exact source revisions, hashes, canonical point mappings, current status, publication/validity, and exact-hash automated-review eligibility matched the configured local `recallloop` database in a bounded read-only question-bank/taxonomy query. No learner tables were accessed and no database writes were made.

| Review evidence | Count | Interpretation |
|---|---:|---|
| Cases statically inspected | 35 | Source identity and structure checked; semantic correctness is not certified |
| Confirmed technical defects | 0 | No defect established by this screen |
| Cases with human risk flags | See `case-audit.json` | Flags request review and are not confirmed errors |
| Blind domain packs | 5 | Seven cases per domain |
| Actual human annotations | 0 | No submission supplied or invented |
| Actual adjudications | 0 | None supplied or invented |
| Human-validated scoring eligible | 0 | All cases await two independent reviews |
| Model outputs / model metrics | 0 / unavailable | Provider remains outbound-blocked; no new request made |

Automated/static flags include generic one-criterion rubric reuse, five response/reference exact matches (possible label leakage), contradictory-response cases, one blank response that the production recall path handles as unanswered without LLM evaluation, and terminology-error relevance review. These are candidates for expert scrutiny, not defect findings. See `case-audit.json` for case-level flags. Keep all v1 proposals provisional and blinded to reviewers.

## Current recheck and risk dispositions (2026-11-02)

The [read-only question-bank quality audit](../../question-bank/quality-audit-2026-11-02.json) rechecked all 35 source revision IDs against the current database: exact current revision, hash, canonical point mapping, and assessment eligibility matched for 35/35, with zero discrepancies. No learner tables were read, and no database writes, provider calls, migrations, seeds, or approval/label changes occurred.

All 37 risk flags are dispositioned below. A flag is not a confirmed defect, label correction, or evidence of model accuracy. The 31 human-review flags remain unresolved without qualified independent reviewers; the six structural concerns require careful benchmark interpretation, not a fabricated human judgment.

Case IDs use the `eval-v1-<domain>-NN` form: `dbms`, `os`, `net`, `dsa`, and `sys`.

| Risk flag | Count | Cases | Disposition |
|---|---:|---|---|
| Generic single-criterion rubric | 26 | DBMS 01-05, 07; OS 01-05, 07; DSA 01-07; System Design 01-07 | Human domain review required to determine whether the broad criterion supports technically defensible grading; keep labels provisional. |
| Verbatim reference-answer synthetic control | 5 | DBMS 01; OS 01; Networks 01; DSA 01; System Design 01 | Structural concern: retain only as an explicit synthetic exact-answer control. This does not establish that a model saw the answer or leaked a label. |
| Contradictory response / expected label | 2 | OS 06; DSA 07 | Human domain review required; no answer-key/label correction is justified without adjudication. |
| Blank response outside production LLM route | 1 | OS 07 | Structural concern: retain as an unanswered-route stress case, not evidence about live evaluator behavior. |
| Terminology, relevance, and target mapping | 3 | DBMS 06; Networks 06; System Design 05 | Human domain review required to establish relevance to the mapped point and defensibility of the provisional label. |

Counts are 37 flags across 30 of the 35 cases; categories overlap. The dataset still has zero annotations, zero adjudications, and zero scoring-eligible cases. `case-audit.json` remains the original 2026-11-01 snapshot; the current exact-match recheck is in the linked quality audit.

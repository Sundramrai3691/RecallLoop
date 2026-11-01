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

Automated/static flags include generic one-criterion rubric reuse, five response/reference exact matches (possible label leakage), contradictory-response cases, one blank response that the production recall path handles as unanswered without LLM evaluation, and terminology-error relevance review. These are candidates for expert scrutiny, not defect findings. See `case-audit.json` for case-level flags. Keep all v1 proposals provisional and blinded from reviewers.

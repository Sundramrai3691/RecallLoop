# AI evaluator benchmark v1 reviewer pack

This packet contains 35 proposed synthetic cases, seven per domain, tied to exact question revisions. Use the dataset at `server/src/services/evaluator/benchmarkDataset.v1.json` as the machine-readable source for full IDs, hashes, point mappings, rubric fields, answer text, and provenance.

## Instructions

Independently judge whether each synthetic answer demonstrates the mapped competency under the cited question and rubric. Record the classification (`correct`, `partial`, or `incorrect`), rationale, rubric evidence, and reviewer identity/credentials in a separate controlled review record. Do not edit the proposed label in place or describe it as human-reviewed until that review actually occurs. Disagreement should be adjudicated by a distinct reviewer. Avoid sending real learner data to this exercise.

All current labels are engineering proposals (`provisional_pending_human_review`). No reviewer decisions or human approvals have been created. The live benchmark report must keep proposed agreement separate from independently reviewed agreement.

| Domain | Cases | Synthetic categories |
|---|---:|---|
| Database Management Systems | 7 | correct, partial, incorrect, misconception, vague/incomplete, terminology error, prompt injection |
| Operating Systems | 7 | correct, partial, incorrect, misconception, vague/incomplete, contradictory, empty |
| Computer Networks | 7 | correct, partial, incorrect, misconception, vague/incomplete, terminology error, prompt injection |
| Data Structures and Algorithms | 7 | correct, partial, incorrect, misconception, irrelevant, very short, contradictory |
| System Design | 7 | correct, partial, incorrect, misconception, terminology error, irrelevant, prompt injection |

The empty answer is a low-level evaluator stress case. The product recall route records blank submission as unanswered and does not invoke the LLM for it.

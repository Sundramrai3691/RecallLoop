# AI evaluation benchmark v1

## Purpose and scope

This benchmark exercises the production free-response evaluator against 35 synthetic answers tied to 35 distinct current non-MCQ revisions: seven each from DBMS, Operating Systems, Computer Networks, DSA, and System Design. Each case stores the source revision ID and content hash, canonical point mapping, prompt, rubric, expected-answer contract, synthetic answer, proposed classification, and rationale. The database inventory used exact current-revision, publication, validity, point-mapping, and exact-hash review predicates. MCQ is excluded because it is deterministically graded.

The dataset is [benchmarkDataset.v1.json](../server/src/services/evaluator/benchmarkDataset.v1.json). The [review pack](research/ai-evaluation-v1/review-pack.md) presents source and label proposals for independent annotation. All 35 proposed labels are `provisional_pending_human_review`; there are zero independent human labels and no human approvals. Do not treat agreement with these labels as model accuracy.

## Running the live benchmark

The opt-in runner calls the same `LlmEvaluator` and configured OpenAI-compatible provider as the application. It uses only synthetic cases and does not connect to PostgreSQL or write learner records. Calls are sequential. A hard transport cap of 35 includes the provider adapter's bounded retry attempts; the evaluator's malformed-JSON retry also consumes the same cap. It stops after authentication/access, quota/rate-limit, connectivity/timeout, or upstream-server failures. It never falls back to mock mode.

From the repository root, explicitly opt in for this run:

```powershell
$env:RECALLLOOP_LIVE_EVAL = '1'
npm.cmd run benchmark:evaluator:live -w server
Remove-Item Env:RECALLLOOP_LIVE_EVAL
```

The runner writes dated and `latest` JSON and Markdown reports under `docs/research/ai-evaluation-v1/`. Reports include evaluator, prompt, and schema identifiers; request count; sanitized output/validation status; confusion matrix; per-class precision/recall/F1; macro F1; false-correct counts; latency percentiles; and provider-reported token usage only when present. Cost is left unavailable because no provider price schedule is applied. Provider response bodies and credentials are not stored.

The application evaluator derives a response classification from coverage (`correct` ≥ .75, `partial` ≥ .4, otherwise `incorrect`). The benchmark records that output and compares it with the provisional case label. A blank synthetic answer is included as a parser/evaluator stress case, but the normal recall submission path treats a blank answer as unanswered without calling the LLM; that case does not represent ordinary route behavior.

## Current run and limits

Latest report: [latest Markdown report](research/ai-evaluation-v1/latest.md) and [latest JSON report](research/ai-evaluation-v1/latest.json). On 2026-11-01 the opt-in run stopped after one outbound request because the configured provider returned the application's sanitized `LLM_UNAVAILABLE`/503 connectivity failure. No model output was graded, no agreement or quality conclusion is available, and the remaining 34 cases were not sent. This is an availability observation for one run, not a grading-quality result.

### Connectivity diagnosis (2026-11-01)

- Safe configuration inspection found `openai-compatible`, model `gemini-3.8-flash`, a present key (value not printed), and HTTPS host `generativelanguage.googleapis.com` with base path `/v1beta/openai/`. The adapter appends `/chat/completions`, yielding the documented Gemini-compatible path. Google's [OpenAI compatibility guide](https://ai.google.dev/gemini-api/docs/openai) documents this base URL, model identifier, bearer credential and chat-completions path; no endpoint/model/request-format defect was found.
- DNS for the configured host resolved. A bounded TCP/TLS reachability probe to port 443 failed locally with `EACCES`; `Test-NetConnection` could not establish TCP. No proxy environment variables were configured. The failure occurs before HTTP, so authentication, quota, model access, request validation and upstream status are unknown. Evidence supports outbound socket access denied by this execution environment. No second model request was made after that external blocker was established.
- The original benchmark call yielded the adapter's former generic `LLM_UNAVAILABLE` / application HTTP 503. That is not an upstream HTTP 503. The live report preserves the failed call and separately records the host reachability evidence; no model output or benchmark metric is inferred.
- Improved the adapter to classify allowlisted nested network codes into DNS, connection refusal/timeout, TLS, proxy, outbound-blocked, or unknown. Learner-facing messages remain generic and safe. `AppError` now retains an optional upstream status separately from the application's status; benchmark records distinguish both and include a sanitized network code when available. Targeted tests cover the classification paths. The configuration and request format were not changed.
- Verification after diagnostic changes: focused provider/benchmark suites passed (32/32); the full unit suite passed (33 files, 175 passed, 4 skipped); root build passed (576.03 kB Vite advisory); config check passed using the local Node `os.userInfo()` workaround; `git diff --check` passed. No database integration was run because this change is independent of PostgreSQL.

Even a complete run is a small synthetic engineering check. The expected labels need independent review; the authored expected answers/rubrics can themselves be wrong. This does not establish evaluator accuracy, fairness, adversarial robustness, educational effectiveness, durable learning, or production reliability. Review the pack and adjudicate labels before using the metrics as quality evidence.

## Independent human validation v2 (2026-11-01)

The original [v1 dataset](../server/src/services/evaluator/benchmarkDataset.v1.json) and its label-inclusive review pack are preserved unchanged. A separate [v2 dataset](research/ai-evaluation-v2/dataset.json) carries each original proposal under `originalProvisionalLabel`; top-level expected labels are null until real review. Five blinded domain packs are in [DBMS](research/ai-evaluation-v2/reviewers/dbms.md), [Operating Systems](research/ai-evaluation-v2/reviewers/operating-systems.md), [Computer Networks](research/ai-evaluation-v2/reviewers/computer-networks.md), [DSA](research/ai-evaluation-v2/reviewers/dsa.md), and [System Design](research/ai-evaluation-v2/reviewers/system-design.md). They omit proposed class/rationale, synthetic category, and model output.

The [annotation protocol](research/ai-evaluation-v2/ANNOTATION_PROTOCOL.md), [JSON schema](research/ai-evaluation-v2/annotation-schema.json), and [adjudication guide](research/ai-evaluation-v2/ADJUDICATION_GUIDE.md) require two independent domain reviewers, quality judgments, an explanation, confidence, and immutable versioned correction. The validation CLI is dry-run by default; append an actual reviewer submission only with `--apply`:

```powershell
npm.cmd run benchmark:annotations -w server -- --in docs/research/ai-evaluation-v2/submission.json
npm.cmd run benchmark:annotations -w server -- --in docs/research/ai-evaluation-v2/submission.json --apply
```

Use `--kind adjudications` for a third qualified, independent adjudicator. Reviewer codes must be pseudonymous; the identity mapping remains outside the repository. The tool does not connect to PostgreSQL, call a provider, or read learner data.

The 2026-11-01 read-only snapshot verified all 35 case revision IDs, exact hashes, canonical mappings, current status, publication/quality state, and exact-hash automated-review eligibility; discrepancies: zero. The content screen established zero confirmed technical defects, while recording 37 risk flags (26 generic single-criterion rubrics, five exact reference-answer controls, two contradictory-answer labels, one blank answer outside the production LLM route, and three terminology/relevance cases). These are review prompts, not defect findings. The [case audit](research/ai-evaluation-v2/case-audit.json) has per-case identity and flags. Actual human annotations/adjudications: zero; scoring-eligible cases: zero. The blank-answer case is explicitly excluded from production-route scoring. Provider connectivity remains outbound-blocked; no provider request or model metric was produced in this milestone.

The 2026-11-02 database-grounded quality audit rechecked the same 35 distinct source revisions against the current selector and found 35 exact current/eligible/hash/mapping matches with zero discrepancies. It dispositions all 37 flags across 30 cases: 31 require independent domain review and six remain structural concerns. Case-grouped dispositions and limits are in [current review status](research/ai-evaluation-v2/REVIEW_STATUS.md); no labels or questions were changed.

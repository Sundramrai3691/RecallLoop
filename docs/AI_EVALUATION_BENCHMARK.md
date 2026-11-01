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

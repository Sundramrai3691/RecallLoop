# AI evaluator benchmark live check (2026-11-01)

- Status: blocked before a valid provider response
- Provider/model: openai-compatible / gemini-3.8-flash
- Endpoint: HTTPS generativelanguage.googleapis.com/v1beta/openai/chat/completions (documented compatibility path)
- Cases selected / provider attempts: 35 / 1 of 35
- Valid outputs / invalid-output cases / unattempted cases: 0 / 0 / 34
- Provider-error cases / retries: 1 / 0
- Case failure category: outbound_blocked; app-normalized status 503; upstream HTTP status unavailable because the request did not get a response
- Reachability evidence: DNS resolved; bounded TCP/TLS probe failed with EACCES; no proxy environment configured
- Labels: provisional only; independent human labels: 0
- Agreement/F1: unavailable; no model output was received
- Usage: not supplied; cost not estimated
- Stop reason: host network environment denied outbound socket access; no repeat model call was made

## Confusion matrix

No cases produced valid model output. The matrix is intentionally empty rather than treating provider failure as an incorrect learner answer.

| Expected \ Predicted | Correct | Partial | Incorrect |
|---|---:|---:|---:|
| correct | 0 | 0 | 0 |
| partial | 0 | 0 | 0 |
| incorrect | 0 | 0 | 0 |

## Connectivity diagnosis

The configured URL shape and model are consistent with [Google Gemini OpenAI compatibility documentation](https://ai.google.dev/gemini-api/docs/openai). The configured key was present (its value was not displayed); DNS resolves the configured hostname. The direct socket/TLS check failed locally with EACCES before an HTTP exchange. No proxy environment variables were set. This is evidence of outbound network permission denial in the current execution environment. It does not establish provider authentication, quota, request validation, or model availability, because no upstream HTTP response was received.

The original benchmark attempt returned the application’s sanitized LLM_UNAVAILABLE / 503. The endpoint reachability probe was separate and used no API key. The report does not claim an upstream 503.

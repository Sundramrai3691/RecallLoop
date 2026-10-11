# ADR 008: Explicit provider configuration and visible failures

## Status

Accepted as an implementation decision recorded on 2026-10-11.

## Context

Provider factories previously treated unknown provider labels as a compatible LLM or deterministic local embedding/remediation provider. A configured LLM without a key also silently selected mock behavior. Those paths made a real-provider configuration appear active when requests were actually local or deterministic.

## Decision

- `LLM_PROVIDER` accepts `mock` and `openai-compatible`.
- `EMBEDDING_PROVIDER` accepts `mock` and `openai-compatible`.
- `REMEDIATION_PROVIDER` accepts `mock` and `llm`.
- A selected real provider with missing credentials, an unknown provider label, a failed HTTP request, or an invalid response raises an explicit application error. Provider HTTP bodies and credentials are not logged or returned.
- Gemini may use the OpenAI-compatible adapter at `https://generativelanguage.googleapis.com/v1beta/openai`; the adapter sends bearer authentication and uses `/chat/completions` and `/embeddings`.
- For Gemini 3 models, omit the sampling `temperature` field and retain the model default.
- Embedding dimensions are validated per response, stored alongside the model identifier, and used as a retrieval filter. The current PostgreSQL `real[]` representation permits the Gemini default 3072 dimensions without a schema migration.
- Question generation remains built-in; it is not configured through these provider values.

## Consequences

Unsupported legacy values such as `openai` must be changed to `openai-compatible`; they no longer silently choose a provider. Mock mode remains deterministic when explicitly selected. Live provider verification is isolated behind an opt-in smoke test and does not run as part of the unit suite.

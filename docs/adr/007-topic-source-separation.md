# ADR 007: Keep study topic and source separate

## Status

Accepted in the Phase 1 repair implementation.

## Context

Study creation used the learner's title as the extraction topic while allowing raw material to be empty. The local evaluator synthesized generic knowledge points from that title, and the LLM extraction prompt explicitly allowed a topic-only concept. This made a pasted URL capable of becoming the concept and question identity without any fetched source content.

## Decision

Treat the topic, optional external source URL, and supplied text as separate values. Require supplied text for extraction, reject a URL-shaped topic, save only an optional HTTP(S) source URL as provenance, and never claim this flow fetches webpage or video content. Extract and validate before persisting a study session so provider or schema failure does not leave an empty session behind. Deterministic local extraction remains available but is identified as mock behavior.

## Consequences

Migration `013` adds a nullable URL column while preserving historical sessions. New source links can be opened from the session. Concepts remain personal records with text knowledge-point labels; they do not yet have canonical point UUIDs. URL fetching and source-title discovery are not implemented. See [Core Learning Roadmap](../CORE_LEARNING_ROADMAP.md) for later canonical mapping and content work.

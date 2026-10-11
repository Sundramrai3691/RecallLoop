# ADR 009: Preserve canonical identity through study handoffs

- Status: Accepted
- Date: 2026-10-11

## Context

RecallLoop has a shared role/skill/topic/concept/point catalog and separate learner-owned study sessions, extracted personal concepts, and answer evidence. Previously the New Study picker reduced canonical suggestions to display strings, so a study could not be attributed to the selected catalog node.

## Decision

Study sessions may reference a canonical topic and, when the learner selected a specific concept, that concept as well. The service validates that the concept belongs to the submitted topic. Custom topics keep both canonical links null. Existing records remain unmapped unless an explicit, reliable relationship is established.

An extracted personal concept inherits the selected canonical concept only when its normalized name equals that selected node's name exactly. This contextual exact mapping is explicit to the learner's selected node; similar names and custom sessions stay unmapped.

Recall point evidence can reference a canonical knowledge point only when its normalized statement matches exactly one point under the selected canonical concept. Case and repeated whitespace are normalized; fuzzy similarity and ambiguous duplicates do not create links. Learner roadmap state is derived from completed sessions and persisted submitted assessment/recall evidence. Session completion never creates mastery evidence.

## Consequences

Role roadmap nodes can start a study session with stable IDs and preserve a local return path. Role/skill/topic/concept/point hierarchy and direct prerequisite edges use the existing catalog. Roadmap status is intentionally coarse (`not_started`, `studied`, `assessed`); it does not imply mastery or readiness. Historical sessions and point labels are not backfilled. Canonical catalog reads remain shared; user-specific progress endpoints require authentication.

## Evidence

Migration `014_canonical_study_handoffs.sql`; `knowledgeService.getRoleRoadmap`; `studySessionService.createStudySession`; `resolveCanonicalKnowledgePoint`; New Study and Knowledge Role pages.

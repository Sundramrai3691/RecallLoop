# Architecture decisions

These records describe decisions evidenced by the implementation and committed history. They are retrospective: the repository does not preserve the original discussion or decision owners, so none are claimed here. See [ADRs](adr/) for concise records.

| ADR | Decision | State / evidence |
|---|---|---|
| [001 PostgreSQL runtime](adr/001-postgresql-runtime.md) | PostgreSQL is the single runtime database, accessed through `pg`. | Accepted; migrations and server wiring are present. |
| [002 Deterministic domain decisions](adr/002-deterministic-domain-decisions.md) | Scheduling, planning, and selection are deterministic; model output is bounded and validated. | Accepted; service and evaluator code. |
| [003 Canonical and personal knowledge](adr/003-canonical-and-personal-knowledge.md) | Shared role knowledge and individual learner evidence use separate models. | Accepted; migrations and knowledge/learner services. |
| [004 User-provided grounding](adr/004-user-provided-grounding.md) | Grounded remediation retrieves from user-provided, owner-scoped text and tracks evidence. | Accepted; migration `010` and grounding services. |
| [005 Grounding embeddings without pgvector](adr/005-grounding-embedding-storage.md) | Store fixed-dimension embedding values in PostgreSQL `real[]` and rank bounded per-user candidates in application code. | Accepted for the initial implementation; migration `010` and retrieval service. |

Historical feature commits are visible in Git (`git log`); the commit message establishes implementation chronology, not the reasoning or authorship of a formal decision. Revisit a record when the implementation or constraints change.

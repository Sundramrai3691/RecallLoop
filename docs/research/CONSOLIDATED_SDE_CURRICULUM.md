# Consolidated SDE Knowledge Foundation

**Status:** bounded foundation and pilot specification, not a claim of complete curriculum coverage or independent expert validation.  
**Snapshot date:** 2026-10-29.  
**Machine crosswalk:** [curriculum_crosswalk.json](curriculum_crosswalk.json).  
**Source registry:** [source_registry.json](source_registry.json).

## Purpose and evidence rules

This consolidates the three supplied research inputs into a source-aware map of a practical software-development-engineering foundation. It is a curriculum proposal and a read-only crosswalk to the existing canonical catalog. It does not create or import taxonomy rows, questions, prerequisite edges, or source links.

Claims are separated by type: normative technical behavior; behavior of a named implementation and version; pedagogical sequencing; broad employer-stated topic relevance; and candidate-reported interview anecdotes. The last category is excluded from frequency estimates here because the supplied candidate reports lack stable item-level permalinks and the inputs disagree about whether they were directly inspected. The Amazon early-career preparation page is a broad employer-stated topic list, not a universal bar, weight table, or source of technical truth.

The tiers below are curriculum priorities, not company-specific probabilities:

- **Must Know:** a transferable foundation expected for general entry-level SDE learning and work; rationale is conceptual dependency and practical use.
- **Frequently Tested:** useful applied competency with explicit broad topic-list support or recurring engineering relevance; this label does not assert a measured interview frequency.
- **Advanced / Context-Dependent:** deepen for a role, level, product area, or chosen goal; do not make it a universal entry-level gate.

Unmapped areas remain explicit gaps; labels in this document do not imply mastery, assessment availability, or source coverage in the app.

## Recommended scope and sequence

| Order | Foundation | Priority | Observable outcome | Current catalog relationship and gap |
|---|---|---|---|---|
| 1 | Programming fundamentals: language semantics, variables, control flow, functions, collections, errors, basic I/O | Must Know | Trace a short program, explain state changes, and implement a small requirement in a named language | No dedicated canonical foundation domain/sequence. Language-specific behavior needs a selected language and official documentation. |
| 2 | Complexity and algorithmic reasoning | Must Know | State input assumptions, compare time/space costs, and justify a workable approach | Partial through the two DSA concepts and four points; not a complete complexity or algorithm catalog. |
| 3 | Data structures and algorithms | Must Know | Choose and apply arrays, hashing, trees, graphs, sorting/searching, and basic dynamic programming; reason about edge cases | Existing DSA maps to two concepts/four points. Arrays/hash and BFS/DFS make the eight-point pilot. Trees, heaps, sorting, and DP are not established as covered by this snapshot. |
| 4 | Object-oriented and small-scale design | Must Know | Define responsibilities, interfaces, state ownership, and testable boundaries for a small component | No explicit OOP/LLD concept coverage. Do not conflate object design with existing distributed System Design competencies. |
| 5 | Operating systems and concurrency | Must Know | Explain processes/threads, scheduling, address spaces, synchronization, races, and deadlock reasoning at conceptual depth | Two concepts/four points. Process/thread isolation and a shared-invariant race make the pilot; OS source chapter verification remains open. |
| 6 | DBMS and SQL | Must Know | Model relational data, write joins/aggregations, reason about transactions/isolation, and select indexes for stated queries | Six concepts but four points and eligible assessment points span only two concepts (transaction and index). SQL and relational modeling concepts currently have no points. Pilot selects two existing points. |
| 7 | Computer networks and HTTP | Must Know | Explain TCP transport/interface behavior, HTTP request semantics, caching, and the boundaries between layers | Three concepts/four points currently assessed: TCP and HTTP. IP, UDP, DNS, TLS and HTTP/1.1 framing are explicit coverage gaps. The selected pilot uses two TCP points. |
| 8 | Testing, debugging, and code quality | Must Know | Reproduce a fault, isolate a cause, select unit/integration tests, and explain a corrective change | No explicit canonical area in this snapshot. Assessment and project-defense objectives need an additive, curated mapping. |
| 9 | Git and Linux/developer workflow | Frequently Tested | Use version control, shell/filesystem/process tools, and a reproducible local workflow | No dedicated canonical area. POSIX/Linux claims should be pinned to an inspected standard or implementation manual. |
| 10 | Application security basics | Must Know | Recognize trust boundaries, validate/authorize inputs, protect secrets, and map common risks to mitigations | No dedicated canonical security area. OWASP Top 10 is an awareness taxonomy, not a verification standard or exhaustive security curriculum. |
| 11 | API/backend fundamentals | Frequently Tested | Design resource-oriented interfaces, authentication/authorization boundaries, persistence, failures, and safe retries | Existing Backend Engineering has 16 concepts and five points, but HTTP/API catalog concepts presently have no points. Backend taxonomy must be mapped and assessed before claiming coverage. |
| 12 | System design and distributed systems | Advanced / Context-Dependent | For a stated scope, reason about capacity, boundaries, replication, consistency, failure and recovery | Existing System Design has five concepts/five points. Retain for relevant goals and more advanced roles; not a universal prerequisite for first topic assessment. |
| 13 | Behavioral communication and project defense | Goal-dependent companion competency | Explain a real contribution, decision, trade-off, failure, and outcome with evidence | Separate from technical knowledge taxonomy. Candidate reports are insufficient to claim prevalence or company-specific requirements. |
| 14 | AI-assisted engineering | Optional / time-sensitive | Verify generated changes, test outputs, provenance, privacy, and security in a named tool context | Keep optional and versioned; do not treat tool familiarity as a stable universal foundation without current role evidence. |

Suggested learning dependencies are a pedagogical proposal, not edges in the live catalog: programming fundamentals → complexity/DSA → OS, DBMS, and networks; programming fundamentals → OOP/small-scale design → testing/debugging and API/backend work; DBMS/network fundamentals → role-scoped system design. Security and Git/Linux practice should accompany implementation rather than be postponed to the end. Prerequisites should be stored only after catalog IDs, direction, and cycle checks are reviewed.

## Bounded assessment pilot

The crosswalk specifies eight already-existing canonical knowledge-point IDs: two DSA, two OS, two DBMS, and two TCP. It records all 48 current revision IDs and content hashes, maps each to the authored bank, and verifies exact hash equality, point mapping, valid/published/automated-reviewed status, and an exact-hash automated approval. Each point currently has six eligible revisions in a 2 MCQ + 3 rapid-recall + 1 distinct short-explanation shape. This is a count of eligible revisions, not six distinct assessment objectives, independent human approvals, or proof of correctness. Pilot objectives, misconceptions, source status, and limitations are in the JSON artifact.

| Area | Pilot competency | Assessment/readiness boundary |
|---|---|---|
| DSA | Choose array scan vs hash lookup; choose BFS vs DFS for a stated graph objective | Require assumptions and complexity; don't imply expected hash complexity is a worst-case guarantee. |
| OS | Distinguish process/thread address-space sharing; identify a race over an invariant | Must name the relevant model/assumptions. Source exact-section verification is outstanding, so keep these as provisional candidates. |
| DBMS | Predict a transaction anomaly at a stated isolation level; reason about composite B-tree column order for a stated query | PostgreSQL 18 official sections support the proposed objectives. Existing pilot revisions cite PostgreSQL 16 `mvcc.html`; that supports transaction behavior but is not the index-specific source for the composite-index point. The citation defect is recorded; revisions were not modified. |
| Networks | Explain TCP sequence/retransmission behavior; explain that TCP is a byte stream without application message boundaries | Ground protocol facts in RFC 9293; don't infer exactly-once application processing. |

The automated-reviewed bank is eligible for the existing selector, but this research task did not submit learner attempts or measure outcomes. It does not constitute a live learner pilot, blind item review, browser validation, or educational-effectiveness study. The OS process/thread, OS race/invariant, and PostgreSQL composite-index candidate families now have exact-section checks and revised answer/key/rubric contracts in immutable revision 2. Obtain independent subject-matter review before a learner pilot. Unassessed competencies remain unknown.

## Catalog and provenance snapshot

The crosswalk's catalog snapshot was generated read-only through the server's application-configured PostgreSQL pool against the local `recallloop` database; credentials are not recorded. It contains 34 canonical concepts and 26 knowledge points. Eligible point coverage for the four taxonomy domains is four points each; these are not equivalent to complete foundational coverage. The database has zero prerequisite edges and zero `concept_sources` links. `knowledge_sources` has 540 rows but only four distinct URLs, so row volume must not be reported as a 540-source foundation. Separately, 18 question revision-2 rows were intentionally inserted and reviewed; no taxonomy rows, learner evidence, or historical revisions were rewritten.

The source registry distinguishes directly inspected excerpts from reports in the supplied research, discovered candidates, superseded references, and blocked citations. An excerpt check does not mean an entire RFC, textbook, or course was read. OSTEP v1.10 ch. 4 §4.1 and ch. 26 §26.1 now ground the process/thread revisions; OSTEP ch. 28 §§28.1–28.2 and v1.20 ch. 32 §§32.1–32.2 plus C++ working-draft [intro.races] ground the explicitly scoped concurrency wording; PostgreSQL 16 §11.3 now grounds the six composite-index revision-2 citations. The TCP facts use RFC 9293; MIT OCW supports DSA topic selection at course-outline level. Revision 1 remains preserved in history, and independent review remains open.

## Conflict and uncertainty register

| Conflict or uncertainty | Reconciliation and disposition |
|---|---|
| Earlier material frames system design as shared interview core; Phase 2 focuses on a reusable early-career core | Keep the existing System Design goal and five points, but place deeper design at Advanced / Context-Dependent. No universal readiness prerequisite inferred. |
| Supplied report cites RFC 8446 as current TLS 1.3 | RFC Editor identifies RFC 9846 (July 2026) as obsoleting RFC 8446. Registry retains 8446 as historical and blocks TLS question authoring until relevant sections are inspected. |
| Supplied research names OWASP Top 10:2021 as latest | OWASP identifies 2025 as its current released Top 10. Treat it as an awareness classification, not a complete testable security standard. |
| Candidate reports are described as both directly inspected and not directly inspected; permanent post URLs are absent and some inline citations mismatch | Mark the collection blocked for item-level evidence. Do not derive interview frequencies, company weights, or copied questions from it. |
| Berkeley, CMU, and MIT links near some research claims do not consistently resolve to the cited institution/topic | Registry keeps corrected official candidate URLs and inspection level; catalog-directory pages are not treated as term-specific syllabus evidence. |
| `source-foundation.md` refers to a companion registry that was absent from `docs/research` | Created a new versioned registry from the available inputs and current checks; it does not assert that the missing artifact was recovered. |
| Catalog records imply more source breadth than source relations support | Actual snapshot has 540 source rows, four distinct URLs, zero concept-source links, and zero prerequisite edges. Source mapping and dependency structure remain catalog integrity work. |
| PostgreSQL docs have multiple version pins | PostgreSQL 18 is used for current implementation-specific reference checks; existing PG16 question citations are not rewritten automatically. Revalidate each revision before changing provenance or claims. |
| Composite-index pilot revision points to an irrelevant PostgreSQL page | Resolved for current candidates: PostgreSQL 16 §11.3 was directly checked, and the six affected items now use immutable revision 2 with the exact index-specific citation, aligned keys/rubric, and exact-hash automated approval. Revision 1 and its historical citation remain preserved. Independent subject-matter review remains open. |
| OS examples vary by teaching OS and POSIX edition | OSTEP v1.10 ch. 4 §4.1, ch. 26 §26.1, and ch. 28 §§28.1–28.2 plus ch. 32 PDF v1.20 §§32.1–32.2 were checked for the relevant process/thread and concurrency claims. C++ working-draft [intro.races] is used only for explicitly C++-scoped data-race claims. Eighteen affected OS/DBMS candidates have immutable revision-2 content and checked answer/rubric contracts; independent subject-matter review and learner validation remain open. No POSIX-specific claim is inferred. |
| Existing taxonomy's presence can be mistaken for broad SDE coverage | The JSON crosswalk preserves IDs and explicit null point mappings. SQL, modeling, API, security, testing, programming fundamentals, and workflow gaps remain visible rather than inferred as covered. |

## Validation and next work

The current JSON artifacts and pilot snapshot received these checks:

- `npm.cmd run test -w server -- --configLoader runner src/services/questionBank/curriculumCrosswalk.test.ts src/services/questionBank/coreSdeQuestionBank.test.ts src/services/questionBank/questionBankQuality.test.ts src/services/questionBank/questionBankGovernance.test.ts src/services/questionBank/questionBankBenchmark.test.ts` ? passed, 5 files / 17 tests. It checks 48 current revision IDs/hashes and statuses, registered exact source sections for the three repaired points, deterministic MCQ keys, complete rubric criteria, and distinct transfer prompts/rubrics.
- `npm.cmd test` ? passed, 27 files / 126 passed / 4 opt-in provider checks skipped. `npm.cmd run test:integration -w server` ? passed, 17/17 against configured PostgreSQL, including preserved revision history and revision-2 approval checks.
- Targeted configured-database verification ? all 18 revision-2 rows match authored hashes and exact automated approval hashes, are valid/published/current, and have 18 preserved revision-1 counterparts; all 48 pilot current revisions match authored hashes and expected review/publication states. Inventory is 179 total revisions and 150 current items. No learner attempts or taxonomy changes were made.
- `npm.cmd run question-bank:coverage` ? reports 24 current candidates for each mapped DSA, OS, DBMS, and Networks domain and 30 for System Design; DBMS blueprint gaps remain. `npm.cmd run question-bank:activation-report -w server` ? existing HTTP blueprint reports 2 MCQs, 3 recall items, and a distinct verification candidate eligible.
- `npm.cmd run build` ? passed server TypeScript, client type-check, and Vite production build; existing 560.21 kB minified client chunk advisory remains.
- `git diff --check` ? final result is recorded in the work-session entry. No browser or learner pilot was run.

The default Vitest config loader previously failed to traverse a parent directory on this Windows host; the repository's existing `--configLoader runner` workaround ran the focused suites. Primary source sections and revised answers/rubrics were checked for claim alignment, and automated checks confirmed authored hashes and scoring structure. This does not establish independent expert validation, question quality in learner use, durable improvement, distinct-transfer effectiveness, or educational outcomes. The crosswalk records the read-only catalog snapshot separately from the later 18 scoped question-revision writes. A browser learner pilot was not run in this task.

Next highest-value work: obtain an independent subject-matter review and then run an isolated learner pilot for the eight-point bank, measuring whether diagnosis, remediation, and distinct verification yield understandable, evidence-backed improvement. The checked source and answer alignment for the three revised points is not human validation or educational-effectiveness evidence. After that, author additive canonical knowledge points for SQL/relational modeling and programming/testing foundations only after a curated source and objective review. A separate additive catalog migration should later address the missing concept-source and prerequisite relationships and audit source deduplication without deleting history.

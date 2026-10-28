RecallLoop Research Package: SDE Knowledge-Base Source Foundation
Research run 28 Oct 2026. Companion file: source_registry.json (machine-readable registry, 28 entries + backlog).
0. Scope and honesty statement
• What was done: about 20 web searches and 3 full page fetches. Fully read: Amazon's recruiter tips page, Amazon's interview topics page, and Microsoft's technical interview article (Jan 2016). Every other source was read only through search-result excerpts, and the registry marks each one inspected_full, inspected_excerpt or discovered_only.
• Not covered: Google's own hiring pages (I could not retrieve them), Apple, Adobe, Atlassian, Uber, Salesforce, Oracle, NVIDIA, Walmart Global Tech, Flipkart, Intuit; DNS RFCs; language specifications; MDN; Linux man-pages; Git docs; NIST; Stanford/Berkeley courses; Kleppmann's DDIA; Blind and Reddit directly. All India-specific and non-sampled-company claims are therefore Unknown.
• Registry size: 28 entries, below the 40-70 target, because I would rather ship 28 labelled entries than pad with unchecked links. A backlog lists 14 named candidates with no URLs (I did not invent any).
• Labels used: [Fact] = supported by a source I saw. [Inference] = my reasoning from facts. [Rec] = recommendation. [Unknown] = not established.
A. Executive recommendation
1. Build the KB on claim-type-specific authority, not one source ranking. Exact technical behaviour comes from the current spec or pinned vendor docs; foundational depth from textbooks and courses; employer expectations from official employer pages only; interview frequency from corroborated reports, always tagged as weak; learning-design choices from peer-reviewed reviews.
2. Start with Tier 0: DSA, programming fundamentals, OOP/OOD, OS, DBMS/SQL, networks/HTTP. [Fact] Amazon's official topic list names programming language, data structures, algorithms, coding, object-oriented design, databases, distributed computing, operating systems and internet topics, and says interviewers want applied problem-solving, not memorised details (Amazon topics, Amazon tips). Microsoft and Meta official pages (both about a decade old) stress CS fundamentals and coding.
3. Treat system design as Tier 2 for entry-level candidates. [Inference] No official page I read says entry-level interviews weight system design. Amazon says system-design whiteboarding appears in "most technical interviews" but gives no level. Secondary guides say new-grad loops are mostly DSA (GeeksforGeeks on Google L3, Simplify on Meta new grad), which is weak evidence. This conflicts with scoping the current push to System Design as the single vertical slice. It is a fine slice for demonstrating architecture, but it should not be the first domain the canonical KB claims interview coverage for.
4. Pin versions now. [Fact] TLS 1.3 is no longer defined by RFC 8446: RFC 9846 (July 2026) obsoletes it. PostgreSQL search results returned unsupported 9.x mirror pages. OWASP has a 2025 Top 10. A KB built from memory or the top search hit would cite superseded material.
5. Use the learning science that is strong, and be cautious about the rest. [Fact] Practice testing and distributed practice received the top utility ratings in Dunlosky et al. 2013. [Inference] FSRS is trained on Anki flashcard review logs, so it is validated for fact recall, not for conceptual understanding or code transfer. Keep the scheduler, but verify understanding with distinct items.
6. Never publish company topic weights. Several guides I saw print percentages (e.g. "technical skills 40% weight", "coding 60%"). I found no methodology behind them and did not use them.
Evidence hierarchy by claim type
Claim type
Authoritative for it
Cannot establish
Exact protocol/OS/language behaviour
Current normative spec (IETF RFCs, POSIX.1-2024), then pinned vendor docs
What is asked in interviews; vendor behaviour as a universal truth
Foundational concepts and depth
Strong textbooks and course syllabi (MIT 6.006, OSTEP, CMU 15-445)
Entry-level depth by themselves; course depth may exceed need
Employer-stated expectations
Official employer pages (Amazon, Microsoft, Meta)
Unstated rubrics, weights, level-specific topic lists
Industry implementation patterns
First-party engineering publications (not yet researched)
That a topic is tested at entry level
Interview-frequency signals
Recent, level-specific, corroborated reports
Company requirements; probabilities
Learning effectiveness
Peer-reviewed reviews and meta-analyses
That a specific scheduler works for conceptual CS knowledge
B. Verified source registry (summary)
Full fields (URL, publisher, version, date checked, licence notes, limitations, confidence) are in source_registry.json. Date checked for all: 2026-10-28.
ID
Source
Family
Read status
SRC-001
Amazon SDE recruiter tips
Employer, official
Full
SRC-002
Amazon software development interview topics
Employer, official
Full
SRC-003
Microsoft: how to ace a technical interview (2016)
Employer, official
Full
SRC-004
Microsoft student interviewing
Employer, official
Excerpt
SRC-005
Meta: preparing for your SWE interview (about 2016)
Employer, official
Excerpt
SRC-006
RFC 9293 TCP (Aug 2022, STD 7)
Standard
Excerpt
SRC-007
RFC 9110 HTTP Semantics (June 2022, STD 97)
Standard
Excerpt
SRC-008
RFC 9846 TLS 1.3 (July 2026)
Standard
Excerpt
SRC-009
RFC 8446 TLS 1.3 (obsoleted)
Standard, superseded
Excerpt
SRC-010
POSIX.1-2024 / Open Group Issue 8 and IEEE record
Standard
Excerpt
SRC-011
PostgreSQL SET TRANSACTION docs
Vendor docs
Excerpt; version needs pinning
SRC-012
OWASP Top 10:2025
Security framework
Excerpt
SRC-013
OSTEP
Textbook
Excerpt (via course syllabi)
SRC-014
MIT 6.006 Spring 2020 syllabus
Course
Excerpt
SRC-015
CMU 15-445/645
Course
Excerpt
SRC-016
Dunlosky et al. 2013
Learning science
Abstract excerpt
SRC-017
Rowland 2014, doi:10.1037/a0037559
Learning science
Excerpt
SRC-018
Adesope et al. 2017
Learning science
Citation only
SRC-019
Frontiers 2018 testing-effect review
Learning science
Excerpt
SRC-020
FSRS repo and benchmark
Scheduler
Excerpt
SRC-021
LeetCode Top Interview 150
Practice
Excerpt
SRC-022
NeetCode
Practice
Discovered only
SRC-023
Glassdoor Amazon SDE review (Jun 2026, Bengaluru)
Community
Excerpt; one report
SRC-024
interviewing.io Google guide
Secondary
Excerpt; dated
SRC-025
GeeksforGeeks Google guide
Secondary
Excerpt
SRC-026
Simplify Meta new-grad guide
Secondary
Excerpt
SRC-027
Prepfully Meta SWE guide
Secondary
Excerpt
SRC-028
Amazon: sample coding challenge (linked from SRC-001)
Employer, official
Discovered only
C. Topic-to-source matrix
Primary = what decides technical correctness. Teaching = for explanation and depth. Interview signal = relevance evidence only.
Domain
Primary
Teaching
Interview signal
Limits and gaps
1. DSA
None (no normative spec)
MIT 6.006: dynamic arrays, heaps, balanced BSTs, hash tables, sorting, graph search, DP; assumes Python and discrete maths
Amazon topics; Meta ~2016 page; LeetCode 150
6.006 exceeds entry-level proof depth. Pattern lists are curation, not frequency data.
2. Language semantics
Official language specs: gap, not researched
Gap
Amazon: familiarity with a prominent language
Choose one language per KP set.
3. OOP/OOD/patterns
Gap
Gap
Amazon topics list OOD; Amazon patterns text seen only in excerpts
Patterns are conventions, so define a source of truth per pattern.
4. OS
POSIX.1-2024 for Unix interfaces
OSTEP: virtualization, concurrency, persistence
Amazon topics list OS
POSIX is not Linux; Linux man-pages not yet checked.
5. DBMS/SQL
PostgreSQL docs for Postgres behaviour; SQL standard not accessed
CMU 15-445: relational model, SQL, storage, indexes, concurrency control, recovery
Amazon topics list databases
PG treats READ UNCOMMITTED as READ COMMITTED and its Repeatable Read prevents phantoms, so isolation questions must say which system. 15-445 is an internals course; use selectively.
6. Networks/HTTP/TLS/DNS
RFC 9293, RFC 9110, RFC 9846; DNS RFC not checked
Textbook not chosen
Amazon: "internet topics"
RFC 9293 obsoletes RFC 793; RFC 9846 obsoletes RFC 8446.
7. LLD/OOD exercises
None
None
One Glassdoor report of an OO-design round; Amazon OOD topic
A single report does not establish a requirement.
8. System design
Spec-level N/A
DDIA and others not researched
Amazon official mentions it generally; entry-level role unknown
Keep Tier 2 pending evidence.
9. Backend/REST/transactions
RFC 9110 (methods, status codes); Postgres docs
Gap
Indirect only
Method idempotency claims must be checked against RFC 9110 section text before use.
10. Testing/debugging
Gap
Gap
[Fact] Amazon says SDEs write scalable, robust, well-tested code and checks edge cases; Microsoft says validate and test solutions
Practice-oriented; assess with executable tests.
11. Linux/Git
POSIX utilities (SRC-010)
Gap
Gap
Pro Git and man-pages are backlog.
12. Application security
OWASP Top 10:2025
Gap
None found for entry level
OWASP is data-informed awareness, not a standard.
13. Reliability/caching/queues
Gap
Gap
None
Defer.
D. Company-interview evidence matrix
Classes: Official = stated by employer; Repeated = corroborated by multiple independent recent reports; Weak = limited or secondary; Unknown. I found no case that meets "Repeated" with independent evidence, because the secondary guides are not independent of each other.
Topic
Amazon
Microsoft
Meta
Google
Coding / DSA
Official (online assessment with coding test; topics list)
Official, general: CS fundamentals, open-ended coding problem (2016)
Official, excerpt: two coding problems on algorithms, data structures, recursion, binary trees (about 2016, screen)
Unknown (official); Weak: guides say entry-level is mainly DSA
OOD
Official, topic list; Weak: one Glassdoor report of an OOD round
Unknown
Unknown
Unknown
OS, DB, internet, distributed
Official, topic list, no level or depth
Unknown
Unknown
Unknown
System design (entry level)
Official in general only; level Unknown
Unknown
Weak: secondary guide says no design round for new grads
Weak: GFG says little or none at L3
Testing / edge cases
Official (write well-tested code, handle bad input)
Official (validate or test solutions)
Unknown
Unknown
Behavioural
Official ("Why Amazon", leadership principles referenced)
Official (fit, adaptability)
Weak: new-grad loop includes one
Weak
AI-assisted coding round
Unknown
Unknown
Weak: one secondary guide mentions an "AI-enabled" round
Unknown; one secondary guide claims a shift to in-person rounds
What these sources do not establish: Amazon's topics page does not say which topics apply to SDE I, how deep, or how often. The Microsoft and Meta pages are about ten years old. No source gives a rubric or weighting. Secondary guides disagree on basic structure (for example, number of Google phone screens), which signals low reliability.
General entry-level expectation [Inference]: DSA coding is the one near-universal component. OOD and CS fundamentals are supported at Amazon by official text and treated as likely elsewhere. Design depth is role- and level-dependent.
E. Initial SDE curriculum roadmap (first release)
Priority model [Rec]. Score each topic 0-3 on: technical importance (TI), prerequisite value (PV), documented interview relevance (DIR, counting only Official or Repeated evidence), breadth across roles (BA), practical engineering value (PE). Combined: 0.30*TI + 0.20*PV + 0.20*DIR + 0.15*BA + 0.15*PE. Frequency evidence (FE) and confidence are stored separately and never enter the score, because current FE is too weak. Thresholds: >=2.4 Tier 0, 1.8-2.39 Tier 1, 1.0-1.79 Tier 2, below 1.0 Tier 3. Weights are judgment, not fitted; revisit once coverage data exists. Keep all individual scores.
Domain
Tier
Ordered clusters
Proficiency
Assessment formats
DSA
0, then 1 for patterns
complexity, arrays/strings, hashing, lists/stacks/queues, trees, graphs BFS/DFS, sorting/search, recursion; then two pointers, sliding window, heaps, DP shapes, backtracking
Implement and analyse
Executable tests, trace, complexity justification
Language semantics
0
value vs reference, memory model, exceptions, equality, one chosen language
Apply
Predict-the-output, bug-find
OOP/OOD
0 then 1
four pillars, SOLID, composition vs inheritance, then common patterns, small LLD exercises
Explain and design
Rubric-scored free response
OS
0
process/thread, scheduling, synchronization, deadlock, virtual memory
Explain and reason
Scenario MCQ, short answer
DBMS/SQL
0 then 1
relational model, SQL, normalization, ACID, indexes; then isolation levels and MVCC
Write and explain
Executable SQL, rubric
Networks/HTTP
0
TCP vs UDP, handshake, HTTP semantics, DNS, TLS concept
Explain
Scenario MCQ, short answer
Backend/API
1
REST resources, status codes, idempotency, transactions in code, async basics
Apply
Design critique, executable tests
Testing/debugging
1
unit tests, edge cases, debugging method
Apply
Write tests that catch seeded bugs
Linux/Git
1
processes, pipes, permissions, branching, rebase vs merge
Use
Command-sequence tasks
Security
1
injection, access control (deny by default), secrets, authn vs authz
Recognise and fix
Vulnerable-snippet review
System design
2
caching, queues, replication, consistency, load balancing
Reason about trade-offs
Rubric-scored design
Reliability/observability
2
timeouts, retries, logging, metrics
Reason
Scenario
DB internals, consensus, ML/AI
3
recovery, B+tree internals, Raft; Amazon lists ML/AI generally
Role-specific
Deferred
Representative atomic knowledge points
ID
Knowledge point
Source of truth
Misconception to include
Status
KP-NET-0008
TCP three-way handshake purpose
RFC 9293
"TCP preserves message boundaries"
Verify section text
KP-DB-0031
PostgreSQL READ UNCOMMITTED behaves as READ COMMITTED
PG docs, pinned version
"Isolation levels behave identically in every DBMS"
Fact from excerpt; pin version
KP-OS-0012
Race condition vs deadlock
OSTEP
"A mutex rules out deadlock"
Pending chapter-level check
KP-SEC-0003
Broken access control; deny by default for non-public resources
OWASP A01:2025
"Hiding a URL is access control"
Fact from excerpt
KP-HTTP-0005
Safe vs idempotent methods
RFC 9110
"POST and PUT are interchangeable"
Blocked until RFC section is read
KP-DSA-0044
Hash table average vs worst-case lookup
MIT 6.006
"Hash lookup is always O(1)"
Pending lecture-level check
Completion criteria for the inventory. A domain counts as covered when every Tier 0 cluster has its atomic KPs, each KP has at least one verified source link, at least two assessment formats, and a misconception list reviewed by a human; and when no served question depends on a blocked KP.
F. Source-quality and content-governance policy
1. Verify and refresh. Standards: check the RFC Editor obsoleted_by field quarterly (this run caught RFC 8446 → 9846). Vendor docs: store the version in the URL, and re-check when a new major version ships. Hiring evidence: treat as stale after 12 months; official employer pages need a date or are tagged "undated".
2. Obsolete or conflicting sources. Never delete: mark superseded_by, re-run the KPs that cite it, and keep the old link for audit. When reputable sources disagree (see Appendix), store both and require the KP to state its scope (system, version or study design).
3. Provenance. Every extracted claim carries claim_class (technical_fact, employer_stated, community_signal, inference) plus a source-locator (section, chapter or lecture). Interview-relevance statements may only cite employer_stated or community_signal; technical statements may only cite normative or primary sources.
4. Versions and revisions. KP IDs are immutable and opaque; edits create a kp_revision row; a question stores kp_id plus kp_revision, so past learner evidence stays interpretable.
5. Licensing. Store bibliographic metadata, links and short original-wording summaries. Do not copy OSTEP text, course notes, LeetCode problem statements or editorials, Glassdoor reports, or paid material; usage terms for most of these were not verified, so treat them as Unknown. Do not scrape sites behind logins or anti-bot controls.
6. Blocking. A KP stays blocked when it has no verified primary source for a technical claim, when sources conflict and scope is unstated, or when its only support is an unlicensed or anecdotal source. Blocked KPs may be drafted but never auto-served or graded.
G. Implementation recommendations for RecallLoop
The stated architecture already has a role → skill → topic → concept model, a Question Bank v1 with provenance, Postgres repositories, Zod, and an evidence-integrity ADR. No parallel system is needed; extend what exists.
Schema [Rec]
• source (id, title, url, publisher, family, read_status, licence_note, last_checked) and source_version (version, published, superseded_by).
• kp_source_link (kp_id, source_id, locator, role: defines | clarifies | exemplifies, verified_by, verified_at).
• Map the existing concept to the knowledge point: add stable kp_id, tier, dimension scores, confidence, claim_class, status (draft | verified | blocked) and a kp_revision table.
• interview_evidence (company, level, stage, topic, class, source_id, source_date, quote-free summary).
• Questions: reference kp_id + kp_revision and source-link IDs only; keep per-question fields (cognitive level, rubric, answer key) as already designed.
Immediate tasks, in order
1. Import source_registry.json through a Zod schema; add a CI link-check that fails on dead or superseded sources.
2. Extend ADR 010 with the four claim classes and the blocking rule.
3. Add a gate: a question cannot be served unless its KP is verified and every technical claim has a source link.
4. Seed 40-60 Tier 0 KPs from the table above.
Later: FSRS integration with item-level difficulty, per-KP review of FSRS defaults on your own data, and automated obsoleted_by polling.
H. Highest-value next actions
Immediate
1. Read and verify the actual sections for the six sample KPs (RFC 9293, RFC 9110 §9, the OSTEP chapters, MIT 6.006 lectures) and unblock or reject each.
2. Retrieve Google's official hiring pages and re-run the Google column; add Flipkart, Uber, Atlassian and Adobe official pages to cover the India-relevant sample.
3. Pin the PostgreSQL major version and replace the SET TRANSACTION link with the transaction-isolation page for that version (I saw only mirrors of 9.x).
4. Decide whether system design stays the Oct-Nov vertical slice; if so, label its KPs Tier 2 so the readiness report does not imply SDE-1 coverage.
5. Implement the provenance schema and the serve gate.
Later 6. Research DNS, language specifications, Git, Linux man-pages and DDIA to fill the "Gap" cells. 7. Run your planned labelled-answer benchmark before trusting rubric grading on Tier 0 free-response KPs. 8. Collect interview evidence systematically (dated, level-tagged, with a source URL per item) so "Repeated" can eventually be earned honestly.
Appendix: conflicts and unresolved uncertainty
• Question format and testing effect. [Fact] Per a Frontiers review, Adesope et al. (2017) found multiple-choice practice produced stronger testing effects than short-answer, whereas Rowland (2014) found the opposite; Rowland excluded applied research. Implication: do not hard-code a format preference; run your own comparison.
• Feedback. [Fact] Rowland's meta-analysis (via the Frontiers review) found feedback boosts testing effects. Retrieval-with-feedback on trained items showed little transfer to untrained items in work cited by Wang and Yang 2025. [Inference] This supports verifying remediation with a distinct item.
• TLS. RFC 9846 obsoletes RFC 8446. Whether the 2026 text changes normative behaviour beyond an editorial update was not verified; an earlier draft described it as editorial.
• PostgreSQL vs SQL standard. Isolation levels are defined by prohibited phenomena in the standard, and PostgreSQL's implementation can be stricter than requested. Always scope isolation questions to a system.
• OWASP 2025. The excerpt I read is the official introduction; one news report said the list was final but the write-up was in preview. Re-check the status before citing sub-sections.
• FSRS. Version names (4.5, 5, 6) and parameter counts changed over time; I did not verify the current version. Benchmark numbers I saw came from third-party READMEs and were not used.
• Unsupported figures I deliberately excluded: Google rejection rates, "technical skills 40% weight", and "coding 60%" topic splits.
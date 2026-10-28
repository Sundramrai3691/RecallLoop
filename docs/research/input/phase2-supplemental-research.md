# RecallLoop Research Phase 2 — Supplemental Research Package

**Run date:** October 28, 2026. **Status:** Supplemental to the two prior RecallLoop research packages; it does not replace or overwrite them.

## Executive summary and limitations

The supplemental evidence strengthens the prior conclusion: RecallLoop’s initial canonical SDE curriculum should center on **programming fundamentals, DSA, OOP/small-scale design, SQL/DBMS, HTTP/web, OS basics, testing/debugging, Git/Linux, secure coding, and API/backend basics**, with system design and distributed systems as role-dependent extensions. Recent first-person reports—especially Amazon India SDE1 reports from 2026—continue to show coding/DSA, complexity discussion, edge cases, behavioral/leadership-principle discussion, and sometimes LLD; several also report a newer GenAI-flavored round. [reddit](https://www.reddit.com/r/developersIndia/comments/1wln5n6/amazon_sde_1_interview_experience_auta_ftc_india/)

**Important limitation:** This phase did **not** achieve a fully inspected, deduplicated 30–60-report corpus. The search results surfaced roughly ten directly relevant, dated first-person reports, concentrated heavily on Amazon and disproportionately on India. That is enough to identify recurring *candidate-reported* formats, but not enough to estimate company-specific topic frequencies, rejection rates, or universal round structures. All candidate evidence below is therefore classified as **first-person candidate report** or **weak/uncorroborated signal**, never as employer policy.

**Evidence-status rule for this package:** Sources whose page content was returned and reviewed in this session are marked `INSPECTED (excerpt/page)`. Sources merely identified are marked `DISCOVERED`. No source should be promoted to “fully verified” in RecallLoop until its live page, version, license, and exact claim scope have been recorded.

***

## Deliverable 1 — Auditable candidate-interview dataset

### Dataset scope and quality controls

- **Target population:** intern, university-graduate/new-grad, and SDE1/SWE1 roles; India emphasized, with limited international comparison.
- **Window:** reports published or explicitly referring to interviews from approximately October 2025 through October 2026.
- **Exclusions:** SDE2/SDE3, data engineering, unrelated job families, and reports without enough detail to classify.
- **Known sampling bias:** Amazon dominates the accessible recent sample; Google, Microsoft, Meta, Adobe, Atlassian, Uber, Salesforce, Walmart Global Tech, Flipkart, Intuit, Stripe, and NVIDIA did **not** yield enough inspected, dated early-career reports in this session to support company-level curriculum claims.
- **No probabilities:** The dataset supports qualitative recurrence observations only.

### Usable reports

| Report ID | Company / role family | Candidate level | Location | Interview date(s) | Publication date | Stages reported | Competency themes / formats | Outcome | Corroboration | Quality / limitations | Confidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CAND-001 | Amazon / SDE1, AUTA + FTC | SDE1; 2025 graduate with prior internship/full-time experience | Chennai, India; virtual rounds | Feb. 18–Sep. 9, 2026 | Sep. 20, 2026 | OA; technical DSA; GenAI with hiring manager; logical/maintainability; bar raiser; hiring-manager round | DSA/coding, maintainability, GenAI discussion, behavioral elements | Not explicitly stated in excerpt | Partially corroborates Amazon OA + multiple technical/behavioral rounds | Long, multi-org journey; role/process may have changed across attempts; self-reported | First-person, dated; medium |
| CAND-002 | Amazon / SDE1 | SDE1 / early-career | Bengaluru, India; virtual rounds | OA in May 2026; onsite July 29, 2026 | Oct. 19, 2026 | OA; onsite/virtual technical rounds | Leadership-principle question; live coding; task-dependency scheduler using topological sort/Kahn’s algorithm; in-memory rate-limiter LLD; constraints and edge cases | Not stated in excerpt | Corroborates coding + LLD + behavioral combination | Detailed but single-report; exact outcome absent | First-person, dated; medium |
| CAND-003 | Amazon / Development Engineer 202 | Early-career / experienced-adjacent; not a clean SDE1 proxy | United States | OA Sep. 10, 2026; final round Oct. 12, 2026 | Oct. 19, 2026 | OA; four virtual rounds | Coding challenge; AI-code-assistant/backend debugging; work-style/behavioral; leadership principles; LLD or coding; STAR behavioral | Rejected | Corroborates behavioral + coding + debugging + LLD pattern | DE II role, not pure entry-level; retain as comparison only | First-person, dated; medium-low for entry-level inference |
| CAND-004 | Amazon / SDE1 | 2025 graduate / new grad | India; virtual | OA Feb. 16, 2026; rounds Mar. 5–19, 2026 | Apr. 1, 2026 | OA; two technical rounds; behavioral round; bar raiser | Two DSA questions; edge cases; brute-force-to-optimized discussion; dry run; binary-tree problem; leadership principles; STAR | Offer reported | Corroborates DSA + behavioral + bar-raiser structure | Self-reported offer; question concepts summarized, not reproduced | First-person, dated; medium-high |
| CAND-005 | Amazon / SDE new grad | New grad | Not stated; likely U.S. or international | May 13–14, 2026 | Jul. 8, 2026 | Interview loop | Reports a thorough loop; no usable topic detail in accessible excerpt | No decision after eight weeks | Weak | Minimal content; retained only as process-timing evidence | First-person, dated; low |
| CAND-006 | Amazon / SDE1 | SDE1 / early-career | India; on-campus for 2026 fresher batch | Jul. 9–Aug. 20, 2026 | Sep. 11, 2026 | Two technical rounds; GenAI round; behavioral round | Binary-tree problem; probability-based selection problem; time/space complexity; dry run; edge cases; deadline behavioral question; leadership principles | Selected | Corroborates DSA, complexity explanation, behavioral, and newer GenAI round | Campus-specific; detailed but single-report | First-person, dated; medium-high |
| CAND-007 | Amazon / SDE1, AUTA | ~1.5 years’ experience; SDE1-level process | Not stated | Technical DSA and subsequent rounds in 2026; rejection in early June | Jun. 9, 2026 | Technical DSA; additional technical; GenAI; bar raiser | BFS/Rotten Oranges-style graph problem; approach, complexity, edge cases; leadership principles; GenAI questions; coding in bar-raiser round | Rejected | Corroborates graph/BFS, complexity, behavioral, GenAI round | Candidate had prior experience; not a clean new-grad sample | First-person, dated; medium |
| CAND-008 | Amazon / Grad SDE | New grad | Not stated | Onsite final loop, early 2025 | Mar. 31, 2025 | Bar raiser; behavioral + OOD; coding round | File-system OOD; requirements clarification; directory search; hashmap counting; top-K/heap reasoning; behavioral | Rejected | Partially corroborates OOD + coding + behavioral mix | Outside the preferred Oct. 2025–Oct. 2026 window; useful comparison only | First-person, dated; medium-low |
| CAND-009 | Amazon / SDE new grad | New grad | Not stated | Interview scheduled around March 2025 | Mar. 18, 2025 | Process discussion | No usable competency detail | Unknown | Weak | Primarily a request for experiences; exclude from thematic analysis | First-person, dated; low |
| CAND-010 | Amazon / SDE2 India | SDE2 | India | June 2026 | Jun. 20, 2026 | DSA/coding; LLD; HLD; bar raiser | DSA/coding, LLD, HLD, behavioral | Unknown | Comparison only | SDE2; must not determine entry-level curriculum | First-person, dated; low for this mission |

**Primary sources:** Reddit first-person reports CAND-001 through CAND-010. [reddit](https://www.reddit.com/r/developersIndia/comments/1wln5n6/amazon_sde_1_interview_experience_auta_ftc_india/)

### Recurring candidate-reported patterns

| Pattern | Reports supporting it | Evidence class | Curriculum implication |
|---|---|---|---|
| Live coding / DSA | CAND-001, CAND-002, CAND-004, CAND-006, CAND-007, CAND-008 | Corroborated pattern across independent reports | DSA remains the highest-priority shared domain |
| Explaining approach, complexity, dry runs, and edge cases | CAND-004, CAND-006, CAND-007, CAND-008 | Corroborated pattern | Assess explanation and verification, not only final code |
| Behavioral / leadership-principle discussion | CAND-002, CAND-003, CAND-004, CAND-006, CAND-007, CAND-008 | Corroborated pattern | Add a non-technical readiness track; do not treat it as a CS knowledge point |
| LLD / object-oriented design | CAND-002, CAND-003, CAND-008 | Corroborated pattern, though less universal | Keep OOP/LLD in the shared core at practical depth |
| Graph traversal / BFS-type problems | CAND-006, CAND-007 | Repeated but small sample | Keep BFS/DFS as Tier 1 |
| Trees, hashing, heaps / top-K | CAND-004, CAND-006, CAND-008 | Repeated but small sample | Keep trees, hash maps, and heaps as Tier 1 |
| Debugging / maintainability | CAND-001, CAND-003 | Repeated but small sample | Elevate debugging and code-quality assessment from optional to core |
| GenAI-flavored interview discussion | CAND-001, CAND-003, CAND-006, CAND-007 | Repeated but employer/process-specific and rapidly evolving | Add a small, clearly time-stamped “AI-assisted development awareness” extension; do not make it a universal gate |
| SQL / DBMS / OS / networking questions | Not observed in the inspected recent reports | Unknown / insufficient recent evidence | Retain as foundational engineering curriculum, but do not claim recent interview frequency from this sample |
| System design / HLD | CAND-003, CAND-008, CAND-010 | Mixed-level evidence | Keep as Tier 2; CAND-010 is SDE2 and cannot establish SDE1 expectations |

### Negative evidence and gaps

- The inspected recent reports provide **little direct evidence** about SQL, operating systems, computer networks, testing, or formal security questioning in early-career loops. This is a coverage gap, not evidence that these topics are unimportant.
- No inspected Google, Microsoft, Meta, Adobe, Atlassian, Uber, Salesforce, Walmart Global Tech, Flipkart, Intuit, Stripe, or NVIDIA candidate report met the date, role-level, and detail thresholds in this session. Company-specific claims for those employers remain **unknown**.
- GeeksforGeeks maintains company interview-experience indexes, including Flipkart, Microsoft, Amazon, and Walmart, but the indexed pages surfaced in this session include older entries and do not by themselves establish a current, auditable early-career sample. [reddit](https://www.reddit.com/r/leetcode/comments/1jo84go/amazon_grad_sde_interview_experience/)
- Candidate preparation reflections—such as outlining a baseline solution, testing edge cases, communicating complexity, and using STAR—should be treated as **candidate-reported practices**, not proven scoring criteria. [reddit](https://www.reddit.com/r/Btechtards/comments/1x9tnx9/amazon_sde1_interview_experience_october_2026/)

***

## Deliverable 2 — Interview-preparation guide comparison

| Guide | Publisher / type | Role level / scope | Verified content and recommendations | Evidence basis | Use for RecallLoop | Status |
|---|---|---|---|---|---|---|
| Amazon SDE interview topics | Amazon Careers; official employer guidance | SDE candidates; university OA separately addressed | Lists programming language, data structures, algorithms, OOD, databases, distributed computing, OS, and Internet topics; directs candidates to confirm subjects with recruiting contact; university OA page says no specific Amazon functional knowledge is required and recommends practicing the chosen language and using the practice test.  | Official employer guidance | Strongest source for broad employer-stated topic families; no topic weights | INSPECTED (search-result page content) |
| Microsoft technical interviewing | Microsoft Careers; official employer guidance | Role-dependent technical candidates | Emphasizes problem solving, technical principles/methods, clean bug-free code, testing, algorithms, common data structures, and role-dependent system design/distributed systems; networking guidance includes HTTP, TLS, TCP/IP, and routing.  | Official employer guidance | Use for general coding, testing, complexity, and role-dependent design expectations | INSPECTED (search-result page content) |
| LeetCode Top Interview 150 | LeetCode; commercial practice platform | Interview preparation; recommends roughly 3+ months | 150 original/classic questions; claims comprehensive interview-topic coverage; includes editorials.  [geeksforgeeks](https://www.geeksforgeeks.org/category/experiences/interview-experiences/page/84/) | Commercial curation; not employer evidence | Use as a practice-pattern inventory and coverage check; never as technical authority or frequency proof | INSPECTED (landing page excerpt) |
| Striver’s A2Z DSA Sheet | takeUforward; commercial/community preparation | Beginners through advanced DSA / coding interviews | 20 modules, 495 topics, 131.4 hours; sequences programming foundations, flowcharts/pseudocode, language choice, strings, linked lists, sliding window/two pointers, stacks/queues, and advanced topics; recommends learning one language well enough to write/run programs, use I/O, types, operators, control flow, functions, arrays/strings, errors, debugging, and standard containers.  [geeksforgeeks](https://www.geeksforgeeks.org/interview-experiences/company-interview-corner/) | Commercial preparation guidance | Useful for sequencing DSA from foundations to patterns; do not infer employer frequency from its popularity | INSPECTED (landing/lesson excerpts) |
| takeUforward interview-prep hub | takeUforward; commercial preparation | India and international interview prep | Provides separate DSA, Core CS, System Design, and Data Engineering hubs; India-oriented plans include Striver’s 180 and 75; international plan includes Striver’s 150; also includes a Blind 75 sheet.  [takeuforward](https://takeuforward.org/strivers-a2z-dsa-sheet/learning/programming-languages-and-choosing-a-path) | Commercial preparation guidance | Useful signal for regionally differentiated preparation paths; not evidence of actual employer requirements | INSPECTED (hub excerpt) |
| roadmap.sh Computer Science | roadmap.sh; community-maintained roadmap | Self-taught developers / broad CS learners | Curriculum covers language choice, data structures, complexity, searching/sorting, trees, graphs, backtracking, greedy algorithms, string algorithms, UML/design patterns, math/complexity classes, databases, networking, security, and computer-architecture/OS concepts.  [takeuforward](https://takeuforward.org/strivers-a2z-dsa-sheet/learning/flowcharts-and-pseudocode) | Community curation | Strong breadth map; must be reconciled with course sequencing and technical sources | INSPECTED (roadmap PDF content) |
| roadmap.sh beginner guidance | roadmap.sh; community-maintained | Self-taught beginners | Points beginners to Computer Science, Data Structures, System Design, and software-design roadmaps.  [roadmap](https://roadmap.sh/computer-science) | Community curation | Useful for learner-path metadata only | INSPECTED (excerpt) |
| GeeksforGeeks Interview Experiences | GeeksforGeeks; community reports plus preparation guides | Broad; company-specific pages vary | Maintains company interview-experience collections and preparation guides for companies including Flipkart, Microsoft, Amazon, and Walmart.  [reddit](https://www.reddit.com/r/leetcode/comments/1jo84go/amazon_grad_sde_interview_experience/) | Mixed: community reports + editorial guides | Use only report-by-report with date, role, and corroboration checks | INSPECTED (index excerpts) |
| Google, Meta, Adobe, Atlassian, Uber, Salesforce, Walmart Global Tech, Flipkart, Intuit, Stripe, NVIDIA official prep | Various employers | Varies | Not inspected at page level in this session | Unknown | Keep as `DISCOVERED`; verify before adding employer-expectation claims | DISCOVERED |
| Interviewing.io, Educative, NeetCode detailed guides | Various commercial platforms | Varies | Not inspected at page level in this session | Unknown | Keep as `DISCOVERED`; do not use for technical truth | DISCOVERED |

### Broadly useful preparation principles

These are **preparation recommendations**, not claims that every employer assesses them identically:

1. Clarify the problem, constraints, inputs, outputs, and edge cases before coding.
2. Produce a correct baseline before optimizing.
3. Explain the chosen data structure and algorithm, including time and space complexity.
4. Trace an example through the implementation.
5. Write clean, runnable code in one familiar language.
6. Test normal, boundary, empty, duplicate, negative, and large-input cases.
7. Debug systematically: reproduce, isolate, form a hypothesis, test it, and fix the cause.
8. Explain design choices, alternatives, and trade-offs.
9. Be able to discuss projects, individual contributions, decisions, failures, and results.
10. Prepare behavioral narratives using a structured method such as STAR, without treating STAR as a universal employer rubric.

Amazon’s official university guidance is consistent with principles 1–6 at a general level: it directs candidates to practice their chosen coding language and use its practice assessment.  Microsoft’s guidance supports clean code, testing, complexity, and role-dependent design/networking preparation. 

***

## Deliverable 3 — Roadmap comparison

| Roadmap / plan | Maintainer | Audience and prerequisites | Sequence and coverage | Assessments / exercises | What it includes that RecallLoop should use | Limitations | Status |
|---|---|---|---|---|---|---|---|
| roadmap.sh Computer Science | roadmap.sh community | Self-taught developers; no single fixed prerequisite chain | Language → data structures → algorithms → complexity → design patterns/UML → databases → networking → security → computer architecture/OS.  [takeuforward](https://takeuforward.org/strivers-a2z-dsa-sheet/learning/flowcharts-and-pseudocode) | Resource links rather than a complete assessed curriculum | Broad CS coverage; explicit inclusion of OS, networking, DBMS, security, and architecture | Checklist-like; mixes beginner and advanced material; not employer evidence | INSPECTED (PDF content) |
| roadmap.sh DSA | roadmap.sh community | Learners preparing for coding interviews | Data structures and algorithm patterns; linked from Computer Science roadmap.  [roadmap](https://roadmap.sh/computer-science) | Resource links; not a full assessment system | DSA topic inventory | Less rigorous than a university algorithms course for proofs/invariants | DISCOVERED for detailed page |
| roadmap.sh System Design | roadmap.sh community | Developers preparing for system-design discussions | Scaling, load balancing, caching, CDNs, CAP, queues, API styles, and related architecture topics appear in the CS roadmap’s system-design section.  [takeuforward](https://takeuforward.org/prep-hub?open=dsa) | Resource links | Role-dependent Tier 2 topics | Not appropriate as a universal entry-level requirement | DISCOVERED for detailed page |
| roadmap.sh Backend | roadmap.sh community | Backend developers | API design, databases, caching, queues, and backend architecture topics are represented across roadmap.sh’s related roadmaps.  [roadmap](https://roadmap.sh/pdfs/roadmaps/computer-science.pdf) | Resource links | Backend extension topics | Role-specific; not a shared SDE1 gate | DISCOVERED for detailed page |
| LeetCode Top Interview 150 | LeetCode | Candidates with roughly 3+ months of preparation time | 150 classic/original questions across interview topics.  [geeksforgeeks](https://www.geeksforgeeks.org/category/experiences/interview-experiences/page/84/) | Problems and editorials | High-coverage practice inventory | Problem list, not a concept curriculum; licensing restricts reuse | INSPECTED (landing excerpt) |
| Striver’s A2Z DSA Sheet | takeUforward / Striver | Beginners to advanced DSA learners | 20 modules, 495 topics; begins with language foundations, flowcharts/pseudocode, then strings, linked lists, sliding window/two pointers, stacks/queues, and advanced material.  [geeksforgeeks](https://www.geeksforgeeks.org/interview-experiences/company-interview-corner/) | 495 problems/topics, contests, progress tracking | Strong sequencing model: language readiness → core DSA → patterns → advanced | Commercial; problem statements and full course content must not be copied | INSPECTED (excerpts) |
| Striver’s 75 / 180 / 150 | takeUforward | India-oriented and international interview prep variants | Separate India and international preparation tracks.  [takeuforward](https://takeuforward.org/strivers-a2z-dsa-sheet/learning/programming-languages-and-choosing-a-path) | Topic/problem counts and time estimates | Shows that preparation paths can be regionally differentiated | Marketing/curation, not employer evidence | INSPECTED (hub excerpt) |
| Blind 75 / related lists | Community-curated; multiple hosts | Interview-focused DSA practice | Compact high-yield problem list; takeUforward hosts a 10-module/68-topic version.  [takeuforward](https://takeuforward.org/strivers-a2z-dsa-sheet/learning/programming-languages-and-choosing-a-path) | Problems | Useful as a compact practice inventory | No prerequisite structure or conceptual depth by itself | INSPECTED (hub excerpt) |
| Coding Interview University | Community-maintained GitHub curriculum | Self-taught candidates preparing for large tech interviews | Referenced by roadmap.sh as a related resource.  [takeuforward](https://takeuforward.org/prep-hub?open=dsa) | Varies by version | Broad self-study reference | Must inspect current repository before inclusion | DISCOVERED |

### Cross-roadmap findings

**Common foundational concepts:** language fundamentals, arrays/strings, hash tables, linked lists, stacks/queues, trees, heaps, graphs, recursion, sorting, binary search, BFS/DFS, dynamic programming, complexity analysis, and basic OOP/design patterns. These recur in roadmap.sh’s CS map, Striver’s sequence, LeetCode’s interview-plan framing, and university courses. [geeksforgeeks](https://www.geeksforgeeks.org/category/experiences/interview-experiences/page/84/)

**High-coverage interview topics:** graphs, trees, hashing, heaps, two pointers/sliding window, binary search, sorting, recursion, and dynamic programming.

**Topics appearing in fewer roadmaps:** formal complexity classes, advanced string algorithms, advanced balanced trees, network routing internals, database internals, distributed consensus, and specialized security. These should remain Tier 2/Tier 3 unless the learner’s target role requires them.

**Important CS fundamentals that roadmaps underweight:** systematic debugging, test design, code review, reproducibility, version-control workflows, and operational debugging. Roadmaps often list technologies more thoroughly than they assess the ability to diagnose and repair faulty systems.

**Checklist versus learning sequence:** roadmap.sh is broad but checklist-like; Striver’s A2Z sheet is more explicitly sequenced; MIT 6.006 is sequenced around concept dependencies and graded problem sets. RecallLoop should use roadmaps for coverage and sequencing signals, but use courses and primary documentation for conceptual correctness and prerequisite ordering. [leetcode](https://leetcode.com/studyplan/top-interview-150/)

***

## Deliverable 4 — Course-syllabus and curriculum crosswalk

| Course / textbook | Institution / authors | Level and prerequisites | Verified module structure | Interview relevance | RecallLoop use | Status |
|---|---|---|---|---|---|---|
| MIT 6.006, Spring 2020 | MIT OCW; Demaine, Ku, Solomon | Undergraduate introduction; mathematical maturity and programming expected | Week 1: introduction/data structures; Week 2: sorting/hashing; Week 3: linear sorting; Weeks 4–5: binary trees/AVL/heaps/BFS; Week 6: DFS/weighted shortest paths; Weeks 7–8: Bellman-Ford/Dijkstra/Johnson; Weeks 9–11: dynamic programming and complexity; includes problem sets, recitations, quizzes, and a final exam.  [roadmap](https://roadmap.sh/get-started) | Very high for DSA reasoning | Primary pedagogical sequence for DSA Tier 0–1 | INSPECTED |
| UC Berkeley CS61B | UC Berkeley EECS | Undergraduate; requires CS61A, CS61B alternative, or ENGIN7 | Fundamental dynamic data structures: lists, queues, trees, linked structures, arrays, strings, hash tables, storage management, software-engineering principles, abstract data types, sorting/searching, and Java.  [ocw.mit](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/assignments/) | Very high for data-structure implementation and software-engineering habits | Core DSA + basic SE source | INSPECTED |
| UC Berkeley CS168 | UC Berkeley EECS | Undergraduate; requires CS61B; CS61C recommended | Internet architecture: layering, addressing, intra/inter-domain routing, reliable delivery, congestion control, TCP, UDP, IP, DNS, HTTP, Ethernet, and wireless.  [ocw.mit](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/mit6_006s20_final/) | Moderate for general SDE1; high for backend/network roles | Networking Tier 1–2 source | INSPECTED |
| CS168 Fall 2026 site | UC Berkeley; Stoica and Ratnasamy | Undergraduate networking | Begins with architecture/protocols, layers/headers, links/multiplexing, routing, BGP, DNS/HTTP, transport projects, Ethernet/STP, datacenters, SDN, overlays, and AI collectives; includes multiple programming projects.  [www2.eecs.berkeley](https://www2.eecs.berkeley.edu/Courses/CS61B/index.html) | Moderate; projects exceed typical interview depth | Use for sequencing and project-based understanding; not a mandatory SDE1 gate | INSPECTED |
| CMU 15-445/645 | Carnegie Mellon | Undergraduate/graduate database systems; systems-programming background expected | Design and implementation of DBMS; relational/document/key-value models; storage, indexes, transactions, concurrency, recovery, query processing, and distributed/parallel database topics.  | Moderate for general SDE1; high for backend/database roles | SQL/transactions core at concept level; internals at Tier 2 | INSPECTED |
| OSTEP | Arpaci-Dusseau & Arpaci-Dusseau | Undergraduate OS; programming background | Processes, scheduling, memory/virtualization, concurrency, and persistence. | High for OS fundamentals | Core OS pedagogical source | DISCOVERED in this session; previously identified |
| Princeton Algorithms | Sedgewick & Wayne | Undergraduate algorithms | Algorithms and data structures with Java-oriented implementations and exercises. | High for DSA | Secondary DSA source | DISCOVERED |
| Stanford CS145 | Stanford | Introductory databases | Relational databases and SQL. | High for SQL fundamentals | Introductory DBMS source | DISCOVERED |
| Software-engineering / testing courses | Institution-specific | Varies | Not inspected in this session | Unknown | Needed to strengthen testing/code-quality domain | DISCOVERED |
| Introductory distributed systems | MIT 6.824 and similar | Advanced; strong systems background | Not inspected in this session | Low for universal SDE1; high for infrastructure | Tier 2–3 extension only | DISCOVERED |

### Course-to-RecallLoop crosswalk

| RecallLoop domain | Recurring course concepts | Recommended order | Interview depth for shared core | Advanced material to defer |
|---|---|---|---|---|
| Programming fundamentals | Language constructs, I/O, types, control flow, functions, collections, errors, debugging | First | Write and debug small correct programs; explain references, mutability, and errors | Runtime internals, compiler theory, advanced memory models |
| DSA | Dynamic arrays, hashing, sorting, binary trees/AVL, heaps, BFS/DFS, shortest paths, DP, complexity | After programming fundamentals | Implement and analyze common structures/algorithms; explain invariants and trade-offs | Advanced graph algorithms, string algorithms, NP-completeness proofs, specialized data structures |
| OOP / LLD | Abstract data types, encapsulation, interfaces, composition, design patterns, UML | After programming fundamentals | Design a small class model and justify trade-offs | Large-scale architecture, enterprise patterns, domain-driven design |
| OS | Processes/threads, scheduling, virtual memory, synchronization, file systems | After programming fundamentals | Explain process/thread differences, race conditions, locks, and memory basics | Kernel implementation, scheduler internals, advanced virtualization |
| DBMS / SQL | Relational model, keys, joins, aggregation, normalization, transactions, ACID, indexes | After programming fundamentals | Write correct SQL; explain keys, joins, transactions, and basic indexes | Storage engines, query optimization, recovery, distributed databases |
| Networks / web | Layering, IP, TCP/UDP, DNS, HTTP, congestion, TLS | After programming fundamentals; can run parallel with DBMS | Explain HTTP request lifecycle, TCP vs UDP, DNS resolution, TLS purpose | Routing protocols, BGP, SDN, data-center networking, wireless |
| Testing / quality | Abstract data types, specifications, edge cases, debugging, software-engineering principles | Throughout | Write meaningful tests and debug systematically | Property-based testing, formal verification, large-scale QA infrastructure |
| Security | Hashing/encryption/encoding distinctions, OWASP Top 10, public-key cryptography | After web/DBMS basics | Identify common vulnerability classes and secure defaults | Cryptanalysis, threat modeling at enterprise scale, compliance programs |
| System design / distributed systems | Scaling, caching, queues, replication, consistency, CAP | After core backend/DB/network basics | Explain basic caching/queue/replication trade-offs | Consensus, sharding strategy, stream processing, multi-region architecture |

MIT 6.006 explicitly frames its scope as elementary data structures—dynamic arrays, heaps, balanced BSTs, hash tables—and algorithmic approaches including sorting, graph search, and dynamic programming, with performance analysis throughout.  Its calendar confirms that dynamic programming appears after trees, heaps, BFS/DFS, and shortest-path algorithms, supporting RecallLoop’s prerequisite ordering.  Berkeley CS61B similarly places data structures, abstract data types, sorting/searching, and software-engineering principles together, supporting the integration of implementation skill with conceptual understanding. [roadmap](https://roadmap.sh/get-started)

***

## Deliverable 5 — Deduplicated, reconciled source registry

### Registry reconciliation rules

- Preserve prior entries and their original verification status.
- Add a `phase2_status` field: `INSPECTED_PHASE2`, `DISCOVERED_PHASE2`, `NEEDS_RECHECK`, or `SUPERSEDED`.
- Keep `technical_fact`, `implementation_behavior`, `pedagogical_explanation`, `employer_expectation`, `candidate_report`, `preparation_recommendation`, and `learning_science` as separate claim types.
- Never allow a candidate report, roadmap, or commercial guide to support a technical-correctness claim.
- Never allow a textbook or roadmap to establish an employer’s interview requirements.

### Registry additions and status changes

| Source ID | Source | Phase 2 status | Claim types it may support | Changes / conflicts |
|---|---|---|---|---|
| EMP-AMAZON-SDE-TOPICS | Amazon SDE interview topics | INSPECTED_PHASE2 | Officially stated employer expectation | Confirms broad topic families; does not establish weights or questions.  |
| EMP-AMAZON-OA | Amazon university OA prep | INSPECTED_PHASE2 | Officially stated employer expectation | No specific Amazon functional knowledge required; language practice and practice test recommended.  |
| EMP-MICROSOFT-TECH | Microsoft technical interviewing | INSPECTED_PHASE2 | Officially stated employer expectation | Role-dependent system design/distributed systems; networking topics named.  |
| CAND-AMZN-2026-01 … CAND-AMZN-2026-07 | Amazon India/US first-person reports | INSPECTED_PHASE2 | Candidate-reported interview signal | Add interview date and publication date separately; do not aggregate into frequencies.  [reddit](https://www.reddit.com/r/developersIndia/comments/1wln5n6/amazon_sde_1_interview_experience_auta_ftc_india/) |
| CAND-AMZN-2025-01, CAND-AMZN-2025-02 | 2025 Amazon grad reports | INSPECTED_PHASE2 | Candidate-reported interview signal, historical comparison | Outside preferred window; retain as comparison only.  [reddit](https://www.reddit.com/r/amazonsdeprep/comments/1s8iqxq/amazon_sde_1_interview_experience_2026/) |
| PRACTICE-LEETCODE-150 | LeetCode Top Interview 150 | INSPECTED_PHASE2 | Preparation recommendation; practice inventory | Commercial; do not copy problems or treat as employer evidence.  [geeksforgeeks](https://www.geeksforgeeks.org/category/experiences/interview-experiences/page/84/) |
| ROADMAP-TAKEUFORWARD-A2Z | Striver’s A2Z DSA Sheet | INSPECTED_PHASE2 | Preparation recommendation; learning sequence | 20 modules / 495 topics; begins with language and algorithm foundations.  [geeksforgeeks](https://www.geeksforgeeks.org/interview-experiences/company-interview-corner/) |
| ROADMAP-TAKEUFORWARD-HUB | takeUforward prep hub | INSPECTED_PHASE2 | Preparation recommendation | Separate India and international tracks; includes Blind 75.  [takeuforward](https://takeuforward.org/strivers-a2z-dsa-sheet/learning/programming-languages-and-choosing-a-path) |
| ROADMAP-SH-CS | roadmap.sh Computer Science | INSPECTED_PHASE2 | Community curation; breadth coverage | Broad but checklist-like; includes OS, networking, DBMS, security, architecture.  [takeuforward](https://takeuforward.org/strivers-a2z-dsa-sheet/learning/flowcharts-and-pseudocode) |
| ROADMAP-SH-INDEX | roadmap.sh roadmaps index | INSPECTED_PHASE2 | Community curation | Confirms separate CS, DSA, system-design, backend, and related roadmaps.  [roadmap](https://roadmap.sh/pdfs/roadmaps/computer-science.pdf) |
| EDU-MIT-6.006 | MIT 6.006 Spring 2020 | INSPECTED_PHASE2 | Pedagogical explanation; foundational sequence | Confirmed lecture sequence and assessment structure.  [roadmap](https://roadmap.sh/get-started) |
| EDU-BERKELEY-CS61B | UC Berkeley CS61B | INSPECTED_PHASE2 | Pedagogical explanation; foundational sequence | Confirmed catalog description, prerequisites, and format.  [ocw.mit](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/assignments/) |
| EDU-BERKELEY-CS168 | UC Berkeley CS168 | INSPECTED_PHASE2 | Pedagogical explanation; networking sequence | Confirmed catalog description, prerequisites, and Fall 2026 schedule.  [ocw.mit](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/mit6_006s20_final/) |
| EDU-BERKELEY-CS168-F26 | CS168 Fall 2026 course site | INSPECTED_PHASE2 | Pedagogical explanation; current sequencing | Projects and advanced networking topics exceed shared SDE1 depth.  [www2.eecs.berkeley](https://www2.eecs.berkeley.edu/Courses/CS61B/index.html) |
| EDU-CMU-15-445 | CMU 15-445/645 | INSPECTED_PHASE2 | Pedagogical explanation; DBMS internals | Keep implementation-heavy units at Tier 2.  |
| GFG-INTERVIEW-INDEX | GeeksforGeeks interview-experience indexes | INSPECTED_PHASE2 | Candidate-report discovery layer | Index only; individual reports require separate verification.  [reddit](https://www.reddit.com/r/leetcode/comments/1jo84go/amazon_grad_sde_interview_experience/) |
| EMP-GOOGLE, EMP-META, EMP-ADOBE, EMP-ATLASSIAN, EMP-UBER, EMP-SALESFORCE, EMP-WALMART-GTECH, EMP-FLIPKART, EMP-INTUIT, EMP-STRIPE, EMP-NVIDIA | Employer careers/preparation pages | DISCOVERED_PHASE2 | Potentially official employer expectation after inspection | No company-level claim should be made yet |
| PRACTICE-NEETCODE, PRACTICE-INTERVIEWING-IO, PRACTICE-EDUCATIVE | Commercial preparation platforms | DISCOVERED_PHASE2 | Preparation recommendation after inspection | Not technical authority |
| SPEC-TLS-RFC8446 | TLS 1.3 | NEEDS_RECHECK | Technical fact | Recheck current RFC status and any successor/obsolescence updates before production |
| SEC-OWASP-TOP10 | OWASP Top 10:2021 | NEEDS_RECHECK | Security awareness / prioritization | Keep 2021 explicitly labeled as the current verified edition only after rechecking for a newer release; prior research recorded v1.1 on July 13, 2025.  |
| DOC-PYTHON, DOC-JAVA, DOC-GO, DOC-CPP, DOC-PG, DOC-MYSQL | Official language/database documentation | NEEDS_RECHECK | Implementation-specific behavior | Pin major version and retrieval date; behavior is version-sensitive |

### Conflict and uncertainty register

| ID | Issue | Current resolution | Remaining uncertainty |
|---|---|---|---|
| UNC-001 | Recent Amazon reports include a “GenAI” round, while older official topic guidance does not name GenAI as a standalone interview topic. | Treat GenAI awareness as a **time-sensitive, employer/process-specific signal**, not a canonical universal SDE competency. | Whether GenAI assessment is stable, role-specific, or temporary.  [reddit](https://www.reddit.com/r/developersIndia/comments/1wln5n6/amazon_sde_1_interview_experience_auta_ftc_india/) |
| UNC-002 | Candidate reports suggest LLD appears in some Amazon early-career loops, but official topic guidance lists OOD broadly rather than prescribing an LLD round. | Keep OOP/LLD in the shared core at practical depth; do not claim every SDE1 loop includes LLD. | Round-level consistency across teams and years.  [csd.cmu](https://csd.cmu.edu/course/15445/s25) |
| UNC-003 | Recent reports provide little SQL/OS/network evidence, while official employer guidance names those domains. | Teach them as engineering foundations; mark recent interview frequency as unknown. | Whether they are commonly assessed in current early-career loops.  [reddit](https://www.reddit.com/r/developersIndia/comments/1wln5n6/amazon_sde_1_interview_experience_auta_ftc_india/)– [reddit](https://www.reddit.com/r/leetcode/comments/1wd8nij/amazon_sde1_interview_experience_2026/) |
| UNC-004 | Roadmaps include advanced topics—NP-completeness, advanced trees, BGP, sharding, consensus—that are not appropriate universal SDE1 gates. | Classify as Tier 2/Tier 3. | Role-specific thresholds vary by employer and team.  [takeuforward](https://takeuforward.org/prep-hub?open=dsa) |
| UNC-005 | OWASP Top 10 and TLS documentation require version rechecking. | Keep current entries provisional; recheck before production. | Latest release/supersession status at production ingestion time. |
| UNC-006 | The candidate sample is Amazon-heavy. | Do not generalize Amazon patterns to other employers. | Need independently inspected reports for Google, Microsoft, Meta, India product companies, and others. |

***

## Deliverable 6 — Revised common-core SDE curriculum

### Shared core: sequence and expected depth

| Order | Domain | Topic clusters | Representative atomic knowledge points | Target proficiency | Primary / pedagogical sources | Interview evidence | Misconceptions | Assessment formats | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Programming fundamentals | Language mechanics, data types, control flow, functions, collections, errors, I/O | Value vs reference; mutability; scope; exceptions; arrays/lists; dictionaries/maps; string operations; basic debugging | Write, explain, and debug small correct programs in one language | Official language docs; Striver’s language-readiness sequence; CS61B | General coding prerequisite; candidate reports emphasize live coding | Confusing reference semantics with copying; assuming integer arithmetic is always safe | Code completion, executable tests, bug diagnosis, short explanation | Every Tier 0 point has definition, prerequisite chain, source, misconception, and at least two assessment formats |
| 2 | Complexity and algorithmic reasoning | Big-O/Theta/Omega, amortized cost, recursion, space complexity | Analyze loops, recursion, nested data access, and common library operations | Derive and justify time/space complexity | MIT 6.006; CLRS; roadmap.sh CS | Candidate reports repeatedly mention complexity discussion | Big-O is not wall-clock time; amortized cost is not per-operation worst case | Complexity identification, code-analysis task, explanation | Learner can analyze unfamiliar code and defend the analysis |
| 3 | Core DSA | Arrays, strings, hash maps/sets, linked lists, stacks, queues | Implement/use core structures; choose based on access pattern | Select and implement appropriate structures | MIT 6.006; CS61B; Striver A2Z; LeetCode 150 as practice inventory | Strong candidate-reported recurrence | Hash maps are unordered by default; linked lists are not automatically faster | Coding, invariant explanation, data-structure selection | All Tier 0/Tier 1 structures have implementation, complexity, and misuse coverage |
| 4 | Searching, sorting, heaps | Binary search, merge/quick/heap sort, heaps, priority queues | Search invariants; sorting stability; heap operations; top-K | Implement and reason about standard algorithms | MIT 6.006; CLRS | Candidate reports mention heaps/top-K and optimization | Binary search requires a monotonic structure; quicksort’s worst case is quadratic | Coding, invariant task, test design | Core algorithms have correctness conditions and edge-case coverage |
| 5 | Trees and graphs | Tree traversals, BSTs, BFS, DFS, connected components, topological sort | Represent graphs; traverse; detect cycles; model dependency problems | Model a problem and select traversal | MIT 6.006; CS61B; Striver A2Z | BFS/graph and tree problems recur in reports | BFS does not solve weighted shortest path; DFS order is not inherently shortest | Coding, modeling exercise, trace evaluation | BFS/DFS/tree coverage includes recurrence, complexity, and failure modes |
| 6 | Dynamic programming | Memoization, tabulation, state design, transitions, base cases | Recognize overlapping subproblems and optimal substructure; implement DP | Formulate and implement a DP solution | MIT 6.006; Striver A2Z | Recurring interview theme in roadmaps and practice plans | DP is formula memorization; all recursion needs DP | Coding, state-design explanation | Core DP patterns have state, transition, base-case, and complexity coverage |
| 7 | OOP and LLD | Encapsulation, abstraction, inheritance vs composition, interfaces, SOLID, common patterns, small LLD | Model entities, relationships, behavior, and extensibility | Design a small system and justify trade-offs | Official language docs; roadmap.sh CS; CS61B | LLD/OOD appears in multiple reports | Inheritance equals reuse; SOLID is a mechanical checklist | Design exercise, code review, rubric-scored explanation | At least 8–12 LLD scenarios with explicit rubrics and trade-off criteria |
| 8 | SQL and DBMS | Relational model, keys, joins, aggregation, normalization, constraints, transactions, indexes | Write queries; design a small schema; explain ACID and basic indexing | Write correct SQL and reason about data integrity | PostgreSQL docs; CMU 15-445; Stanford CS145 | Official Amazon/Microsoft topic lists; weak recent candidate-report evidence | An index always improves performance; normalization always improves runtime | SQL execution, schema critique, anomaly diagnosis | SQL coverage includes query correctness, schema design, transactions, and index trade-offs |
| 9 | Networks, HTTP, and web | IP, TCP/UDP, DNS, HTTP methods/status/headers, TLS, cookies, REST basics | Explain a request lifecycle and common failure modes | Explain web communication and API semantics | RFC 9110; RFC 9293; MDN; CS168 | Official employer topic lists; weak recent candidate-report evidence | HTTP methods have flexible meanings; TLS is only encryption; DNS is only name-to-IP | Trace diagnosis, API-design task, MCQ | HTTP/TCP/UDP/DNS/TLS each have source-backed knowledge points and failure-mode assessments |
| 10 | OS and concurrency | Processes vs threads, scheduling, virtual memory, race conditions, mutexes, deadlocks | Explain concurrency hazards and basic synchronization | Diagnose simple concurrency and memory issues | OSTEP; POSIX; Linux docs | Official employer topic lists; weak recent candidate-report evidence | Threads always improve speed; locks remove all bugs | Scenario diagnosis, code analysis | Process/thread/memory/synchronization points have misconception and diagnosis coverage |
| 11 | Testing, debugging, and quality | Unit/integration tests, assertions, edge cases, logging, debugging workflow, code review | Write behavior-focused tests; isolate and repair defects | Debug systematically and write meaningful tests | Microsoft guidance; CS61B SE principles; framework docs | Microsoft explicitly emphasizes testing; candidate reports mention edge cases and debugging | Coverage proves correctness; tests should mirror implementation | Bug-fix task, test-writing task, review exercise | Every major DSA/DB/API domain has at least one debugging or test-design assessment |
| 12 | Git, Linux, and developer workflow | Commits, branches, merge/rebase, conflicts, files, permissions, processes, pipes, grep, SSH | Use Git and shell safely for common engineering workflows | Recover from common workflow mistakes | Git docs; POSIX; Linux docs | General engineering readiness; weak direct recent interview evidence | Merge/rebase are interchangeable; shared-history rewrite is safe | Scenario simulation, terminal task | Core Git/shell tasks have safe-path and destructive-action distinctions |
| 13 | Application security | AuthN vs AuthZ, injection, access control, crypto misuse, secrets, SSRF, secure defaults | Identify common vulnerability classes and apply secure defaults | Review small code for common security defects | OWASP Top 10:2021; CWE; NIST SP 800-53 | Microsoft mentions security implications; official security frameworks support content | Encoding equals encryption; client-side checks are sufficient | Vulnerability diagnosis, secure-code repair | OWASP-aligned categories have definitions, examples, and remediation criteria |
| 14 | API and backend basics | Resource modeling, status codes, validation, idempotency, pagination, auth, async jobs, transactions | Design a coherent small API and reason about failure/retry behavior | Design and critique a simple backend service | RFC 9110; MDN; PostgreSQL docs; framework docs | Official employer topic families; candidate reports imply practical coding/design | POST is inherently non-idempotent in all contexts; REST mandates a URL format | API design, rubric review, failure-mode diagnosis | API domain includes correctness, validation, idempotency, and transaction-boundary coverage |

### Role-specific extensions

| Track | Add after shared core | Representative topics | Tier | Rationale |
|---|---|---|---|---|
| Backend / platform | Caching, queues, retries, idempotency, replication, load balancing, observability | Cache invalidation; delivery semantics; dead-letter queues; SLOs | Tier 2 | Directly relevant to backend service design |
| Infrastructure / SRE-adjacent | Distributed systems, consensus, fault tolerance, containers, CI/CD, cloud services | Leader election; quorums; deployment pipelines | Tier 2–3 | Requires systems depth beyond general SDE1 |
| Database-heavy backend | Query optimization, storage engines, MVCC, recovery, sharding | Index internals; isolation anomalies; partitioning | Tier 2–3 | CMU 15-445-level material; not universal entry-level |
| Frontend / full-stack | Browser model, DOM, JavaScript event loop, accessibility, state management | Rendering, events, HTTP caching, bundling | Tier 2 | Role-specific |
| Mobile | Mobile lifecycle, offline sync, push, platform constraints | State restoration; battery/network constraints | Tier 3 | Role-specific |
| ML / AI engineering | Model evaluation, feature pipelines, serving, drift, responsible AI | Metrics; data/versioning; inference latency | Tier 3 | Specialized; rapidly evolving |
| AI-assisted development | Prompting, code-review of generated code, verification, security implications | Validate generated code; avoid secret leakage; retain ownership of correctness | Tier 2, time-sensitive | Emerging candidate-reported signal, not yet a stable universal requirement |

***

## Deliverable 7 — How RecallLoop should use this evidence

### Source-to-model mapping

| Source family | Map to | Do not map to |
|---|---|---|
| RFCs, POSIX, ISO, official language specs | Technical facts and normative behavior in canonical knowledge points | Employer expectations or interview frequency |
| PostgreSQL/MySQL/Python/Java/Go/Linux docs | Implementation-specific behavior and version-sensitive caveats | Universal behavior across all systems |
| MIT, Berkeley, CMU, Stanford courses; textbooks | Prerequisites, learning order, conceptual depth, misconceptions | Technical truth where a specification exists |
| Amazon/Microsoft official career pages | Officially stated employer expectations | Hidden rubrics, exact questions, or topic weights |
| LeetCode, NeetCode, Striver, roadmap.sh | Coverage checks, practice sequencing, and learner-path metadata | Technical correctness or employer requirements |
| Dated Reddit/LeetCode Discuss/Glassdoor/GeeksforGeeks reports | Candidate-reported interview signals | Universal company policy or probability estimates |
| Learning-science research | Assessment design, retrieval practice, spaced review, feedback design | Guarantees about an individual learner’s optimal schedule |

### Concrete integration recommendations

1. **Extend, do not duplicate:** Add `phase2_status`, `claim_type`, `interview_date`, `publication_date`, `corroboration_status`, and `evidence_confidence` to the existing source and knowledge-point models.
2. **Map candidate reports only to signal metadata:** A report may justify tagging a knowledge point as `candidate_reported_signal`, with date, employer, role level, location, and confidence—but not as `core_required`.
3. **Keep interview evidence time-boxed:** Candidate-reported signals should expire or downgrade after a defined period, such as 12–18 months, unless independently corroborated.
4. **Separate curriculum approval from question generation:** First approve knowledge points, prerequisites, depth, misconceptions, and rubrics; only then generate or validate assessment items against those approved points.
5. **Require dual evidence for high-stakes claims:** A knowledge point marked `core_required` should have technical/pedagogical support plus either official employer relevance or a clearly labeled practical-engineering rationale—not merely roadmap popularity.
6. **Measure coverage, not volume:** Track the proportion of Tier 0/Tier 1 knowledge points having: verified primary source, pedagogical source, prerequisite chain, misconception, assessment format, rubric/executable criteria, and remediation link.
7. **Handle inaccessible or restricted sources conservatively:** Retain metadata, link, date, and short original summary; do not store full copyrighted text or bypass access restrictions.
8. **Flag AI-era topics separately:** GenAI-related interview signals should be stored with explicit `time_sensitive = true` and should not alter the stable CS core until corroborated across employers and time.

***

## Ranked next actions

### Immediate

1. **Formalize the candidate-report schema** with separate interview and publication dates, role level, location, stage, competency themes, outcome, duplication check, and confidence.
2. **Expand the audited report corpus beyond Amazon**, prioritizing Google, Microsoft, Meta, Adobe, Atlassian, Uber, Salesforce, Walmart Global Tech, Flipkart, Intuit, Stripe, and NVIDIA; target independently inspected reports rather than a quota.
3. **Recheck version-sensitive anchors:** TLS/RFC status, current OWASP Top 10 release, and pinned versions of Python, Java, Go, C++, PostgreSQL, and MySQL documentation.
4. **Approve the shared Tier 0/Tier 1 curriculum** above before expanding the question bank.
5. **Build coverage dashboards** for source verification, prerequisite completeness, misconception coverage, assessment-format coverage, and remediation linkage.
6. **Separate technical, employer, candidate-report, roadmap, and learning-science claim types** in the existing canonical model.

### Later

7. Add role-specific tracks after the shared core reaches the completion criteria.
8. Add a time-sensitive AI-assisted-development extension, revisited quarterly.
9. Add course-derived prerequisite graphs from MIT 6.006, Berkeley CS61B/CS168, CMU 15-445, and OSTEP.
10. Establish a quarterly employer-guidance and candidate-signal refresh cycle, with automatic downgrade of stale or uncorroborated interview claims.

**Final answer to the mission question:** RecallLoop’s initial canonical SDE curriculum should contain a tightly sequenced shared core—programming fundamentals, complexity, core DSA, searching/sorting/heaps, trees/graphs, dynamic programming, OOP/LLD, SQL/DBMS, HTTP/web/networking, OS/concurrency, testing/debugging, Git/Linux, secure coding, and API/backend basics—taught to the depth of explaining, implementing, debugging, and trade-off reasoning rather than memorization. System design, distributed systems, cloud, advanced database internals, and specialized engineering should remain role-dependent extensions. Every important technical claim should trace to a current specification or official documentation; every learning sequence should trace to rigorous course material; every interview-relevance claim should remain explicitly separated into official employer guidance, corroborated candidate reports, or weak signals—and the assessment system should verify understanding through distinct explanations, code/SQL execution, debugging tasks, design rubrics, and remediation-specific rechecks rather than through question count or roadmap popularity. [geeksforgeeks](https://www.geeksforgeeks.org/category/experiences/interview-experiences/page/84/)
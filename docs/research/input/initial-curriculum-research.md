# RecallLoop SDE Interview Knowledge-Base Research Package

**Bottom line:** Build RecallLoop’s foundation as a *small, versioned, source-traced canonical curriculum*—not a large unverified question bank. For technical correctness, anchor each knowledge point to a primary specification or official documentation; for pedagogy, use rigorous university material; for interview relevance, use only official employer guidance and clearly labeled, corroborated community signals. The initial release should prioritize DSA, programming fundamentals, OOP/Low-Level Design, core CS fundamentals, SQL/DBMS basics, web/API fundamentals, testing/debugging, Git/Linux, and secure-coding essentials—while treating deep distributed systems as role-dependent rather than universal entry-level requirements.

**Research-status disclosure:** The pages explicitly inspected in this session are RFC 9110, NIST SP 800-53 Rev. 5, OWASP Top 10:2021, Amazon’s SDE interview-topic and online-assessment pages, Microsoft’s technical-interviewing page, MIT 6.006, and CMU 15-445/645. Other sources below are **discovered candidates** and must pass RecallLoop’s page-level verification workflow before entering the production registry. I do not claim to have inspected every URL listed.

***

## Deliverable A — Executive recommendation

### Strategy

RecallLoop should separate four claim types and never merge them into one “trust score”:

| Claim type | Best evidence | What it cannot establish |
|---|---|---|
| Technical correctness | Current RFCs, ISO/IEC or W3C standards, language specifications, POSIX, official database/language documentation | Interview frequency or employer expectations |
| Conceptual depth | Peer-reviewed textbooks and rigorous university courses | Exact behavior of a particular implementation |
| Employer expectation | Official careers/hiring pages and role descriptions | Hidden rubrics, proprietary questions, topic weights |
| Interview frequency | Corroborated, recent, role-specific candidate reports and practice inventories | Universal company requirements |
| Learning effectiveness | Peer-reviewed reviews/meta-analyses and controlled studies | A guaranteed optimal schedule for every learner |

This separation matters because a source can be excellent for one purpose and poor for another. For example, RFC 9110 is authoritative for HTTP semantics—methods, status codes, representation metadata, and content negotiation—but says nothing about whether a company asks HTTP questions in interviews.  Similarly, Amazon’s public SDE topic page establishes that its technical interviews include programming language, data structures, algorithms, OOD, databases, distributed computing, operating systems, and Internet topics; it does **not** establish topic weights or specific questions. [datatracker.ietf](https://datatracker.ietf.org/doc/html/rfc9110)

### Initial priority

For graduate engineers, interns, and SDE1/SWE1 candidates, RecallLoop’s first curriculum should be:

1. **Tier 0 — Core foundations:** complexity analysis, arrays/strings, hash maps/sets, linked lists, stacks/queues, trees, recursion, sorting/searching, time/space complexity, basic OOP, SQL basics, HTTP basics, Git, testing, and debugging.
2. **Tier 1 — High-yield interview knowledge:** graphs/BFS/DFS, dynamic programming fundamentals, heaps, binary search variants, sliding window/two pointers, concurrency basics, OS process/memory fundamentals, transactions/ACID, indexing, REST/API design, caching, queues, and secure-coding essentials.
3. **Tier 2 — Role-dependent:** advanced system design, distributed consensus, sharding, replication, stream processing, Kubernetes, cloud-native architecture, advanced database internals, and specialized security.
4. **Tier 3 — Specialized extensions:** ML-systems, GPU/systems performance, mobile-specific design, embedded systems, formal verification, and niche protocol internals.

This ordering is supported by public employer guidance: Amazon tells SDE candidates to review CS fundamentals and practice coding, listing programming language, data structures, algorithms, OOD, databases, distributed computing, OS, and Internet topics; Microsoft similarly emphasizes problem solving, clean bug-free code, testing, algorithms, common data structures, and—depending on role—system design and distributed systems.  Amazon’s university online-assessment page also states that no specific Amazon functional knowledge or skills are required and focuses candidates on coding-language practice and its practice test. [amazon](https://amazon.jobs/content/en/how-we-hire/interview-prep/software-development-topics)

### What not to overemphasize

Deep system design should not be a universal entry-level gate. Amazon explicitly positions system-design whiteboarding within its broader SDE process, while its SDE II page describes system design for that level; Microsoft describes system design and distributed systems as role-dependent preparation areas.  Therefore, RecallLoop should mark distributed consensus, CAP trade-offs, replication, and large-scale architecture as **Tier 2 by default**, promoted to core only for backend/infrastructure-specific goals. [amazon](https://amazon.jobs/content/en/how-we-hire/interview-prep/software-development-topics)

***

## Deliverable B — Verified source registry

**Status key:** `INSPECTED` = page content was reviewed in this research session; `DISCOVERED` = identified as a strong candidate but requires page-level verification before production use.

| Source ID | Title | URL | Publisher / author | Category | Evidence tier | Domains | RecallLoop purpose | Version / date | Access / license note | Inspection status |
|---|---|---|---|---|---|---|---|---|---|---|
| SPEC-HTTP-9110 | HTTP Semantics | [https://datatracker.ietf.org/doc/html/rfc9110](https://datatracker.ietf.org/doc/html/rfc9110) | IETF | Primary specification | Technical authority | Web, networks, APIs | Authoritative source for HTTP methods, status codes, headers, content negotiation | RFC 9110, June 2022 | IETF RFC; public; link/summarize conservatively | INSPECTED  [datatracker.ietf](https://datatracker.ietf.org/doc/html/rfc9110) |
| SPEC-HTTP-9112 | HTTP/1.1 | [https://datatracker.ietf.org/doc/html/rfc9112](https://datatracker.ietf.org/doc/html/rfc9112) | IETF | Primary specification | Technical authority | Web, networks | Message syntax and routing for HTTP/1.1 | RFC 9112 | Public RFC | DISCOVERED |
| SPEC-TCP-9293 | Transmission Control Protocol | [https://datatracker.ietf.org/doc/html/rfc9293](https://datatracker.ietf.org/doc/html/rfc9293) | IETF | Primary specification | Technical authority | Networks | TCP semantics, connections, reliability, congestion control | RFC 9293, Aug. 2022 | Public RFC | DISCOVERED |
| SPEC-UDP-768 | User Datagram Protocol | [https://datatracker.ietf.org/doc/html/rfc768](https://datatracker.ietf.org/doc/html/rfc768) | IETF | Primary specification | Technical authority | Networks | UDP semantics; contrast with TCP | RFC 768 | Public RFC | DISCOVERED |
| SPEC-DNS-1034/1035 | DNS concepts and implementation | [https://datatracker.ietf.org/doc/html/rfc1034](https://datatracker.ietf.org/doc/html/rfc1034) | IETF | Primary specification | Technical authority | Networks, web | DNS naming, resolution concepts | RFCs 1034/1035 | Public RFC; newer updates exist | DISCOVERED |
| SPEC-TLS-RFC8446 | TLS 1.3 | [https://datatracker.ietf.org/doc/html/rfc8446](https://datatracker.ietf.org/doc/html/rfc8446) | IETF | Primary specification | Technical authority | Security, networks | TLS handshake, confidentiality, integrity concepts | RFC 8446 | Public RFC | DISCOVERED |
| SPEC-POSIX | POSIX.1-2017 | [https://pubs.opengroup.org/onlinepubs/9699919799/](https://pubs.opengroup.org/onlinepubs/9699919799/) | The Open Group | Primary specification | Technical authority | OS, Linux, systems | Processes, files, signals, shell/API conventions | Issue 7, 2018 edition | Public standard page; check terms before bulk storage | DISCOVERED |
| SPEC-SQL-2023 | SQL standard | [https://www.iso.org/standard/76583.html](https://www.iso.org/standard/76583.html) | ISO/IEC | Primary specification | Technical authority | DBMS, SQL | Vendor-neutral SQL concepts | ISO/IEC 9075:2023 | Paid standard; use metadata/short summaries only | DISCOVERED |
| DOC-PG | PostgreSQL Documentation | [https://www.postgresql.org/docs/](https://www.postgresql.org/docs/) | PostgreSQL Global Development Group | Official implementation documentation | Implementation authority | DBMS, SQL, transactions | Exact PostgreSQL behavior: indexes, MVCC, isolation, EXPLAIN | Current major release | PostgreSQL Licence; public docs | DISCOVERED |
| DOC-MYSQL | MySQL Reference Manual | [https://dev.mysql.com/doc/](https://dev.mysql.com/doc/) | Oracle | Official implementation documentation | Implementation authority | DBMS, SQL | MySQL-specific storage engines, isolation, configuration | Current release | Oracle terms; conservative storage | DISCOVERED |
| DOC-MDN-WEB | MDN Web Docs | [https://developer.mozilla.org/en-US/docs/Web](https://developer.mozilla.org/en-US/docs/Web) | Mozilla | Official/community technical documentation | Strong technical reference | Web, JavaScript, HTTP, browser APIs | Web-platform behavior and examples | Continuously updated | CC-BY-SA for much content; verify per page | DISCOVERED |
| DOC-PYTHON | Python Language Reference | [https://docs.python.org/3/reference/](https://docs.python.org/3/reference/) | Python Software Foundation | Official language documentation | Technical authority | Programming fundamentals | Python semantics, object model, execution model | Current 3.x | PSF license; public docs | DISCOVERED |
| DOC-JAVA | Java Language Specification | [https://docs.oracle.com/javase/specs/](https://docs.oracle.com/javase/specs/) | Oracle | Official language specification | Technical authority | Programming fundamentals, JVM | Java syntax, typing, concurrency memory model | Current SE release | Oracle terms; link/summarize | DISCOVERED |
| DOC-CPP | C++ standard drafts / cppreference | [https://isocpp.org/std/the-standard](https://isocpp.org/std/the-standard) | ISO C++ / Standard C++ Foundation | Primary specification + reference | Technical authority | Programming fundamentals | C++ semantics, memory model, standard library | Current standard | Standard text access varies; use carefully | DISCOVERED |
| DOC-GO | Go Documentation | [https://go.dev/doc/](https://go.dev/doc/) | Google Go team | Official language documentation | Technical authority | Programming, concurrency | Goroutines, channels, memory model, standard library | Current release | BSD-style license; public docs | DISCOVERED |
| DOC-LINUX-KERNEL | Linux kernel documentation | [https://docs.kernel.org/](https://docs.kernel.org/) | Linux Kernel Organization | Official implementation documentation | Implementation authority | OS, systems | Processes, scheduling, memory, syscalls | Current kernel | GPL/GFDL varies by file; verify | DISCOVERED |
| DOC-GIT | Git Documentation | [https://git-scm.com/doc](https://git-scm.com/doc) | Git project | Official tool documentation | Developer workflow | Git, Linux, collaboration | Commits, branches, merge/rebase, remotes | Current Git | GPLv2; docs public | DISCOVERED |
| SEC-OWASP-TOP10 | OWASP Top 10:2021 | [https://top10.owasp.org/2021/](https://top10.owasp.org/2021/) | OWASP Foundation | Security awareness standard | High-value security reference | Application security | Priority web risks: access control, crypto failures, injection, SSRF, etc. | 2021; v1.1 July 13, 2025 | Public; CC-compatible terms should be checked per use | INSPECTED  [top10.owasp](https://top10.owasp.org/2021/) |
| SEC-OWASP-ASVS | OWASP Application Security Verification Standard | [https://owasp.org/www-project-application-security-verification-standard/](https://owasp.org/www-project-application-security-verification-standard/) | OWASP Foundation | Security verification framework | High-value security reference | AppSec, secure coding | Testable security requirements and verification levels | Current release | Public; verify license | DISCOVERED |
| SEC-NIST-800-53 | Security and Privacy Controls | [https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) | NIST | Official security framework | Technical authority | Security, compliance | Control catalog and risk-management context | Rev. 5, updated Dec. 10, 2020 | Public U.S. government publication | INSPECTED  [csrc.nist](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) |
| SEC-CWE | Common Weakness Enumeration | [https://cwe.mitre.org/](https://cwe.mitre.org/) | MITRE | Security taxonomy | Technical authority | AppSec | Precise weakness definitions for question tagging | Continuously versioned | Public; attribution required | DISCOVERED |
| SEC-CVE | CVE Program | [https://www.cve.org/](https://www.cve.org/) | CVE Program | Vulnerability registry | Factual registry | AppSec | Real-world vulnerability examples; not a teaching source alone | Continuously updated | Public; terms vary | DISCOVERED |
| EDU-MIT-6.006 | Introduction to Algorithms | [https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/) | MIT OpenCourseWare | Academic course | Strong pedagogy | DSA, complexity | Core algorithms, data structures, proofs, exercises | Spring 2020 | CC BY-NC-SA; check exact terms | INSPECTED  [ocw.mit](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/) |
| EDU-CLRS | Introduction to Algorithms, 4th ed. | [https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/](https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/) | Cormen, Leiserson, Rivest, Stein | Textbook | Strong pedagogy | DSA, complexity | Canonical algorithm reference; use bibliographic metadata only | 4th ed., 2022 | Copyrighted; do not store full text | DISCOVERED |
| EDU-PRINCETON-ALGS | Algorithms, 4th ed. companion site | [https://algs4.cs.princeton.edu/home/](https://algs4.cs.princeton.edu/home/) | Sedgewick & Wayne | Textbook companion | Strong pedagogy | DSA, Java | Practical implementations and exercises | 4th ed. | Site terms vary; verify before reuse | DISCOVERED |
| EDU-CMU-15-445 | Intro to Database Systems | [https://15445.courses.cs.cmu.edu/](https://15445.courses.cs.cmu.edu/) | Carnegie Mellon University | Academic course | Strong pedagogy | DBMS internals, transactions | Storage, indexes, ACID, concurrency, recovery, query processing | Fall 2026 offering listed | Course materials; respect instructor/site terms | INSPECTED  [csd.cmu](https://csd.cmu.edu/course/15445/s25) |
| EDU-DB-SYSTEMS-CONCEPTS | Database System Concepts, 7th ed. | [https://www.db-book.com/](https://www.db-book.com/) | Silberschatz, Korth, Sudarshan | Textbook | Strong pedagogy | DBMS, SQL, transactions | Broad DBMS theory and modeling | 7th ed. | Copyrighted; metadata/summaries only | DISCOVERED |
| EDU-STANFORD-CS145 | Introduction to Databases | [https://cs145.stanford.edu/](https://cs145.stanford.edu/) | Stanford University | Academic course | Strong pedagogy | SQL, relational modeling | Entry-level relational databases and SQL | Current offering varies | Course terms; verify | DISCOVERED |
| EDU-CS168 | Computer Networks | [https://textbook.cs168.io/](https://textbook.cs168.io/) | UC Berkeley | Academic course/textbook | Strong pedagogy | Networks | Internet architecture, TCP/IP, routing, congestion | Current edition | Site terms; verify | DISCOVERED |
| EDU-KUROSE-ROSS | Computer Networking: A Top-Down Approach | [https://gaia.cs.umass.edu/kurose_ross/](https://gaia.cs.umass.edu/kurose_ross/) | Kurose & Ross | Textbook | Strong pedagogy | Networks | Application/transport/network layers | Current edition | Copyrighted; metadata/summaries only | DISCOVERED |
| EDU-OSTEP | Operating Systems: Three Easy Pieces | [https://pages.cs.wisc.edu/~remzi/OSTEP/](https://pages.cs.wisc.edu/~remzi/OSTEP/) | Arpaci-Dusseau & Arpaci-Dusseau | Textbook | Strong pedagogy | OS | Processes, scheduling, virtual memory, concurrency, persistence | Continuously maintained | Free online; license terms on site | DISCOVERED |
| EDU-CS162 | Operating Systems and System Programming | [https://cs162.org/](https://cs162.org/) | UC Berkeley | Academic course | Strong pedagogy | OS, distributed systems | Processes, threads, memory, file systems, distributed systems | Current semester | Course terms; verify | DISCOVERED |
| EDU-MIT-6.824 | Distributed Systems | [https://pdos.csail.mit.edu/6.824/](https://pdos.csail.mit.edu/6.824/) | MIT PDOS | Advanced academic course | Advanced pedagogy | Distributed systems | MapReduce, Raft, fault tolerance, replication | Recent offerings | Course materials; respect terms | DISCOVERED |
| EDU-DDIA | Designing Data-Intensive Applications | [https://dataintensive.net/](https://dataintensive.net/) | Martin Kleppmann | Engineering book | Strong practitioner reference | Distributed systems, data | Replication, partitioning, consistency, stream/batch processing | 2nd ed. in progress / 1st ed. 2017 | Copyrighted; metadata/summaries only | DISCOVERED |
| EDU-CS61B | Data Structures | [https://cs61b-2.gitbook.io/cs61b-textbook/](https://cs61b-2.gitbook.io/cs61b-textbook/) | UC Berkeley | Academic course/textbook | Strong pedagogy | DSA, Java | Core data structures and algorithmic implementation | Current edition | Course terms; verify | DISCOVERED |
| EDU-CS61 | Machine Structures | [https://cs61.seas.harvard.edu/](https://cs61.seas.harvard.edu/) / Berkeley CS61C variants | Harvard / UC Berkeley | Academic course | Strong pedagogy | Computer architecture, C, systems | Memory, assembly, C, machine representation | Current offerings | Course terms; verify | DISCOVERED |
| EMP-GOOGLE-INTERVIEW | Google interview preparation | [https://www.google.com/about/careers/applications/preparation-guides/](https://www.google.com/about/careers/applications/preparation-guides/) | Google Careers | Official employer guidance | Official employer evidence | DSA, coding, role prep | Public candidate-preparation guidance | Current page | Public careers page | DISCOVERED |
| EMP-MICROSOFT-TECH | Technical interviewing | [https://careers.microsoft.com/v2/global/en/hiring-tips/technical-interviewing](https://careers.microsoft.com/v2/global/en/hiring-tips/technical-interviewing) | Microsoft Careers | Official employer guidance | Official employer evidence | Coding, DSA, testing, system design, networking | Public interview expectations and preparation advice | Current page | Public careers page | INSPECTED  [careers.microsoft](https://careers.microsoft.com/v2/global/en/hiring-tips/technical-interviewing) |
| EMP-AMAZON-SDE-TOPICS | Software development interview topics | [https://amazon.jobs/content/en/how-we-hire/interview-prep/software-development-topics](https://amazon.jobs/content/en/how-we-hire/interview-prep/software-development-topics) | Amazon Jobs | Official employer guidance | Official employer evidence | DSA, OOD, DB, OS, networks, distributed computing | Public topic list and interview-process framing | Current page | Public careers page | INSPECTED  [amazon](https://amazon.jobs/content/en/how-we-hire/interview-prep/software-development-topics) |
| EMP-AMAZON-OA | Online assessment prep for SDE roles | [https://amazon.jobs/content/en/how-we-hire/university/sde-oa](https://amazon.jobs/content/en/how-we-hire/university/sde-oa) | Amazon Jobs | Official employer guidance | Official employer evidence | Coding, university SDE | University SDE OA expectations and practice test | Current page | Public careers page | INSPECTED  [amazon](https://amazon.jobs/content/en/how-we-hire/university/sde-oa) |
| EMP-AMAZON-SDE2 | SDE II Interview Prep | [https://amazon.jobs/content/en/how-we-hire/sde-ii-interview-prep](https://amazon.jobs/content/en/how-we-hire/sde-ii-interview-prep) | Amazon Jobs | Official employer guidance | Official employer evidence | Coding, system design | Explicitly SDE II-level guidance; not SDE1 by default | Current page | Public careers page | INSPECTED  [amazon](https://amazon.jobs/content/en/how-we-hire/sde-ii-interview-prep) |
| EMP-META-CAREERS | Meta careers / interview preparation | [https://www.metacareers.com/](https://www.metacareers.com/) | Meta | Official employer careers site | Official employer evidence | Coding, role prep | Role listings and public preparation material | Current site | Public careers page | DISCOVERED |
| EMP-ATLASSIAN-CAREERS | Atlassian careers | [https://www.atlassian.com/careers](https://www.atlassian.com/careers) | Atlassian | Official employer careers site | Official employer evidence | Role-specific requirements | Job descriptions and public hiring information | Current site | Public careers page | DISCOVERED |
| EMP-UBER-CAREERS | Uber careers | [https://www.uber.com/careers/](https://www.uber.com/careers/) | Uber | Official employer careers site | Official employer evidence | Role-specific requirements | Job descriptions and public hiring information | Current site | Public careers page | DISCOVERED |
| EMP-SALESFORCE-CAREERS | Salesforce careers | [https://careers.salesforce.com/](https://careers.salesforce.com/) | Salesforce | Official employer careers site | Official employer evidence | Role-specific requirements | Job descriptions and public hiring information | Current site | Public careers page | DISCOVERED |
| EMP-FLIPKART-CAREERS | Flipkart careers | [https://www.flipkartcareers.com/](https://www.flipkartcareers.com/) | Flipkart | Official employer careers site | Official employer evidence | India product-company roles | Job descriptions and public hiring information | Current site | Public careers page | DISCOVERED |
| EMP-WALMART-GTECH | Walmart Global Tech careers | [https://careers.walmart.com/technology](https://careers.walmart.com/technology) | Walmart | Official employer careers site | Official employer evidence | India/global product roles | Job descriptions and public hiring information | Current site | Public careers page | DISCOVERED |
| PRACTICE-LEETCODE | LeetCode study plans / problem bank | [https://leetcode.com/studyplan/](https://leetcode.com/studyplan/) | LeetCode | Interview-practice platform | Interview-frequency signal | DSA, SQL, concurrency | Problem-pattern coverage and practice inventory | Continuously updated | Terms restrict bulk scraping/redistribution | DISCOVERED |
| PRACTICE-NEETCODE | NeetCode roadmap | [https://neetcode.io/roadmap](https://neetcode.io/roadmap) | NeetCode | Curated practice roadmap | Interview-frequency signal | DSA patterns | Common problem patterns and learning order | Continuously updated | Check reuse terms; do not copy questions | DISCOVERED |
| PRACTICE-GLASSDOOR | Interview reviews | [https://www.glassdoor.com/Interview/index.htm](https://www.glassdoor.com/Interview/index.htm) | Glassdoor | Community reports | Weak/anecdotal signal | Company-specific interviews | Candidate-reported experiences; requires corroboration | Continuously updated | User-generated; do not treat as fact | DISCOVERED |
| LEARN-RETRIEVAL-PRACTICE | Retrieval practice research | [https://pubmed.ncbi.nlm.nih.gov/?term=retrieval+practice+testing+effect+meta-analysis](https://pubmed.ncbi.nlm.nih.gov/?term=retrieval+practice+testing+effect+meta-analysis) | Multiple researchers / PubMed | Peer-reviewed research index | Learning-science evidence | Assessment design | Testing effect, retrieval practice, spaced practice | Varies by paper | Public index; paper access varies | DISCOVERED |
| LEARN-DUNLOSKY-2013 | Improving Students’ Learning With Effective Learning Techniques | [https://journals.sagepub.com/doi/10.1177/1529100612453266](https://journals.sagepub.com/doi/10.1177/1529100612453266) | Dunlosky et al., Psychological Science in the Public Interest | Peer-reviewed review | Learning-science evidence | Assessment design | Strong evidence for practice testing and distributed practice | 2013 | Publisher access varies | DISCOVERED |

**Registry rule:** no source enters production until RecallLoop records its direct URL, publisher, retrieval date, content version, license/usage determination, and the exact claim scope it supports.

***

## Deliverable C — Topic-to-source matrix

| Domain | Core knowledge areas | Primary technical source | Pedagogical source | Interview-signal source | Limitations / conflicts |
|---|---|---|---|---|---|
| Data structures & algorithms | Arrays, strings, hash maps/sets, linked lists, stacks/queues, trees, heaps, graphs, sorting, binary search, recursion, DP, complexity | CLRS / language-standard complexity definitions | MIT 6.006; Princeton Algorithms; Berkeley CS61B | LeetCode study plans; NeetCode roadmap | “Best” data structure depends on access pattern; asymptotic complexity is not constant-factor performance |
| Programming fundamentals | Types, references vs values, scope, mutability, errors, memory, generics, collections, I/O | Official language specs/docs: Python, Java, Go, C++ | Official tutorials plus CS61/CS61B | Microsoft’s advice to code in one strong language | Language semantics differ materially; never generalize Python behavior to Java/C++ |
| OOP & Low-Level Design | Classes, encapsulation, inheritance, polymorphism, composition, interfaces, SOLID, common patterns, LLD exercises | Official language docs for exact semantics | Refactoring.Guru pattern catalog; university OOD courses | Amazon lists OOD explicitly | Design patterns are conventions, not laws; overuse harms design |
| Operating systems | Processes vs threads, scheduling, virtual memory, paging, synchronization, deadlocks, file systems, signals | POSIX; Linux kernel documentation | OSTEP; Berkeley CS162 | Amazon lists OS; Microsoft discusses testing/robustness | POSIX defines portable interfaces; Linux behavior can extend or differ |
| DBMS & SQL | Relational model, normalization, keys, joins, aggregate queries, transactions, ACID, indexes, isolation | ISO SQL standard; PostgreSQL/MySQL docs | CMU 15-445; Database System Concepts; Stanford CS145 | Amazon lists databases | SQL dialects differ; isolation-level behavior is implementation- and configuration-dependent |
| Networks & web | Layering, IP, TCP, UDP, DNS, HTTP, TLS, REST semantics | RFCs 9110/9112/9293/768/8446; MDN | Berkeley CS168; Kurose & Ross | Amazon lists Internet topics; Microsoft names HTTP/TLS/TCP/IP | HTTP semantics are version-independent in RFC 9110, but syntax differs by HTTP version  [datatracker.ietf](https://datatracker.ietf.org/doc/html/rfc9110) |
| Backend engineering | REST/API design, validation, idempotency, pagination, auth, transactions, async jobs, concurrency | HTTP RFCs; official framework/database docs | MDN; practitioner engineering references | Microsoft emphasizes clean code, testing, boundaries, security implications | REST is an architectural style, not a single mandated specification |
| Testing, debugging, quality | Unit/integration tests, assertions, edge cases, logging, debugging, code review, complexity | Official testing-framework docs | Microsoft interview guidance; university SE courses | Microsoft explicitly expects testing and corner cases | Coverage is not correctness; tests encode assumptions |
| Linux, shell & Git | Files, permissions, processes, pipes, grep, SSH, Git branches/merge/rebase | POSIX; Linux docs; Git docs | OSTEP; official Git Book | General engineering readiness | Git commands can produce different results depending on repository state and configuration |
| Application security | Authentication, authorization, injection, crypto misuse, secrets, SSRF, secure defaults | OWASP Top 10/ASVS; CWE; NIST SP 800-53 | OWASP cheat-sheet series | Microsoft asks candidates to consider security implications | OWASP Top 10 is an awareness prioritization, not an exhaustive vulnerability taxonomy  [top10.owasp](https://top10.owasp.org/2021/) |
| Reliability & distributed systems | Caching, queues, retries, timeouts, idempotency, replication, consistency, fault tolerance, observability | System-specific official docs; RFCs where applicable | DDIA; MIT 6.824; CMU 15-445 advanced units | Amazon/Microsoft list distributed computing/system design | CAP is often misstated; consistency models are nuanced and context-dependent |

***

## Deliverable D — Company-interview evidence matrix

This matrix uses only publicly accessible evidence. It does **not** infer hidden rubrics, proprietary questions, or percentage topic weights.

| Company | Role level addressed | Officially stated | Repeated public evidence | Plausible but weakly supported | Unknown / insufficient evidence |
|---|---|---|---|---|---|
| **Amazon** | General SDE; university SDE OA; SDE II explicitly | Coding, data structures, algorithms, programming language, OOD, databases, distributed computing, OS, Internet topics; online coding assessment; system-design whiteboarding for many technical interviews.  [amazon](https://amazon.jobs/content/en/how-we-hire/interview-prep/software-development-topics) | Community reports commonly emphasize LeetCode-style coding and leadership-principle behavioral interviews, but sample quality and recency vary. | Company-specific frequency of graph/DP/SQL questions. | Exact question bank, interviewer rubrics, topic percentages, and whether every SDE1 loop includes system design. |
| **Microsoft** | Role-dependent; general technical interviewing | Problem solving, clean bug-free code, testing, algorithms, common data structures, complexity; role-dependent system design/distributed systems; networking topics including HTTP, TLS, TCP/IP, and routing.  [careers.microsoft](https://careers.microsoft.com/v2/global/en/hiring-tips/technical-interviewing) | Candidate reports commonly describe coding plus role-specific design discussions, but corroboration is needed before company-level claims. | Exact balance between coding, CS trivia, and design for new-grad roles. | Internal competency rubrics and topic weights. |
| **Google** | General software engineering candidates | Public preparation guidance exists; exact current scope must be verified from the live careers page before inclusion. | Community reports commonly emphasize coding/DSA and Googleyness/behavioral components, but this is not official topic weighting. | Role-specific system-design expectations for early-career candidates. | Company-specific DSA distribution, internal rubrics, and interview-loop composition. |
| **Meta** | Software engineer candidates | Public careers site provides role and preparation information; live page must be verified before specific claims. | Community reports commonly emphasize coding/DSA and product-sense/system design depending on level, but evidence quality varies. | Entry-level product-sense expectations. | Exact new-grad loop structure and topic weights. |
| **Atlassian / Uber / Salesforce / Flipkart / Walmart Global Tech** | Role-specific | Public job descriptions and careers pages can establish posted requirements, but must be inspected per requisition. | Candidate reports vary widely by team, location, and hiring cycle. | Team-specific emphasis on backend, frontend, mobile, or infrastructure. | Any claim that a topic is universally asked across the company. |

### Evidence classification rules

- **Officially stated:** The employer’s own page explicitly names the topic, stage, or evaluation criterion.
- **Repeated public evidence:** Multiple independent, recent candidate reports describe the same stage/topic for the same broad role and location.
- **Plausible but weakly supported:** A few reports, indirect evidence, or role-specific inference.
- **Unknown:** No defensible public basis for a company-level claim.

Amazon’s public page is useful precisely because it distinguishes application from memorization: interviewers assess whether candidates can apply CS fundamentals to solve problems efficiently, not whether they memorize every topic detail.  Microsoft likewise frames interviews around problem-solving, clean implementation, testing, boundary conditions, and security awareness. [amazon](https://amazon.jobs/content/en/how-we-hire/interview-prep/software-development-topics)

***

## Deliverable E — Initial SDE curriculum roadmap

### Stage 1 — Prerequisite foundations

**Goal:** Ensure a learner can reason about programs, complexity, and basic computation before interview-pattern drilling.

| Cluster | Representative atomic knowledge points | Prerequisites | Tier | Expected proficiency | Strongest sources | Common misconceptions | Assessment formats |
|---|---|---|---|---|---|---|---|
| Complexity | Big-O/Theta/Omega; amortized analysis; recursion depth; space complexity | Basic programming | Tier 0 | Explain and derive complexity for common code | MIT 6.006; CLRS | Big-O is not “exact runtime”; O(n) can be slower than O(n log n) at small n | MCQ, code-complexity identification, short explanation |
| Core programming | Variables, types, references, scope, control flow, functions, errors, collections | None | Tier 0 | Write correct small programs; explain semantics | Official language docs | Value vs reference; mutation; integer overflow; floating-point equality | Code completion, executable tests, error diagnosis |
| Basic data structures | Array, string, hash map/set, linked list, stack, queue | Complexity | Tier 0 | Choose and implement appropriate structure | MIT 6.006; CS61B | Hash maps are not ordered by default; linked lists are not always faster | Coding task, complexity justification, debugging task |
| Recursion & iteration | Base cases, call stack, tail recursion, iteration conversion | Functions, complexity | Tier 0 | Convert and debug recursive routines | MIT 6.006 | Forgetting base cases; confusing stack depth with time complexity | Code repair, trace evaluation |

### Stage 2 — Core SDE interview readiness

| Cluster | Representative atomic knowledge points | Prerequisites | Tier | Expected proficiency | Strongest sources | Common misconceptions | Assessment formats |
|---|---|---|---|---|---|---|---|
| Searching & sorting | Binary search variants, merge sort, quicksort, heapsort, stability, lower bounds | Arrays, recursion | Tier 0–1 | Implement and analyze standard algorithms | MIT 6.006; CLRS | Binary search requires sorted/monotonic structure; quicksort worst case is O(n²) | Coding, invariant explanation, test design |
| Trees & heaps | BST, traversals, balanced-tree concepts, heap operations, priority queues | Recursion, complexity | Tier 1 | Select structure and reason about operations | MIT 6.006; CLRS | BST balance is not automatic; heap is not globally sorted | Coding, invariant questions |
| Graphs | Representations, BFS, DFS, connected components, topological sort, shortest paths | Recursion, queues/stacks | Tier 1 | Model a problem as a graph and select traversal | MIT 6.006 | BFS does not solve weighted shortest path; DFS order is not inherently “shortest” | Coding, modeling exercise |
| Dynamic programming | Memoization, tabulation, state definition, transition, base cases | Recursion, complexity | Tier 1 | Formulate and implement a DP solution | MIT 6.006 | DP is not “memorizing formulas”; overlapping subproblems and optimal substructure matter | Coding, state-design explanation |
| Two pointers / sliding window | Sorted-array pointers, fast/slow pointers, window invariants | Arrays, strings | Tier 1 | Maintain an invariant while scanning | LeetCode/NeetCode as practice signals; MIT 6.006 for foundations | Window validity conditions; off-by-one errors | Coding, invariant explanation |
| OOP & LLD | Encapsulation, abstraction, inheritance vs composition, interfaces, SOLID, factory/strategy/observer, small LLD | Programming fundamentals | Tier 0–1 | Design a small class model and justify trade-offs | Official language docs; OOD references | Inheritance is not always reuse; SOLID is not a checklist | Design exercise, code review, rubric-scored explanation |

### Stage 3 — High-yield CS fundamentals

| Cluster | Representative atomic knowledge points | Prerequisites | Tier | Expected proficiency | Strongest sources | Common misconceptions | Assessment formats |
|---|---|---|---|---|---|---|---|
| Processes & threads | Process vs thread, context switching, scheduling, race conditions, mutexes, deadlocks | Programming fundamentals | Tier 1 | Explain concurrency hazards and basic synchronization | OSTEP; POSIX; Linux docs | Threads always improve performance; locks eliminate all concurrency bugs | Scenario diagnosis, code-analysis task |
| Memory & OS | Virtual memory, paging, stack vs heap, caching, file systems | Processes | Tier 1–2 | Explain what happens on allocation/page fault conceptually | OSTEP; Linux docs | Stack/heap rules are language- and runtime-specific | Diagram explanation, MCQ |
| SQL & relational modeling | Tables, keys, joins, aggregation, normalization, constraints, indexes, transactions | Basic programming | Tier 0–1 | Write correct queries; design a small schema | PostgreSQL docs; CMU 15-445; Database System Concepts | Indexes always speed queries; normalization always improves performance | SQL execution, schema critique |
| Transactions & ACID | Atomicity, consistency, isolation, durability, isolation levels, locking/MVCC concepts | SQL basics | Tier 1–2 | Explain anomalies and choose isolation carefully | PostgreSQL docs; CMU 15-445 | ACID’s “C” is not the same as database constraints; isolation levels differ by engine | Scenario diagnosis, SQL task |
| HTTP & web | Methods, status codes, headers, statelessness, caching, cookies, CORS, TLS basics | Networks basics | Tier 0–1 | Explain request/response lifecycle and API semantics | RFC 9110; MDN | HTTP is not inherently stateless at the application layer; status codes have precise meanings | API-design task, MCQ, trace diagnosis |
| TCP/IP & DNS | IP addressing, TCP handshake/reliability, UDP, DNS resolution, ports | Networks basics | Tier 1 | Explain end-to-end communication and failure modes | RFC 9293; RFC 768; DNS RFCs | TCP guarantees application-message boundaries; DNS is not only “name to IP” | Diagram explanation, scenario diagnosis |

### Stage 4 — Application, design, and practical engineering

| Cluster | Representative atomic knowledge points | Prerequisites | Tier | Expected proficiency | Strongest sources | Common misconceptions | Assessment formats |
|---|---|---|---|---|---|---|---|
| REST/API design | Resource modeling, status codes, idempotency, pagination, validation, versioning, auth | HTTP, DBMS | Tier 1 | Design a coherent API and justify trade-offs | RFC 9110; MDN; framework docs | POST is always non-idempotent by nature of the method semantics; REST does not mandate a URL format | API design, rubric review |
| Testing & debugging | Test pyramid, unit/integration tests, assertions, edge cases, logging, reproducible debugging | Programming | Tier 0–1 | Write meaningful tests and diagnose failures | Microsoft guidance; framework docs | 100% coverage proves correctness; tests should verify behavior, not implementation details | Bug-fix task, test-writing task |
| Git & collaboration | Commits, branches, merge vs rebase, conflicts, remotes, pull requests | Basic CLI | Tier 0 | Recover from common Git situations safely | Git documentation | Merge and rebase are interchangeable; rewriting shared history is risk-free | Scenario simulation |
| Linux & shell | Files, permissions, processes, pipes, grep, environment variables, SSH | OS basics | Tier 0–1 | Use command line to inspect and repair systems | POSIX; Linux docs | Permissions are only about read/write/execute; shell quoting matters | Terminal task, diagnosis task |
| Secure coding | Input validation, authn vs authz, injection, secrets, crypto misuse, SSRF, secure defaults | Web, DBMS | Tier 1 | Identify and remediate common vulnerability classes | OWASP Top 10:2021; CWE; NIST SP 800-53 | Encoding equals encryption; client-side validation is sufficient; access control is only login | Vulnerability diagnosis, secure-code repair |

### Stage 5 — Advanced and role-specific depth

| Cluster | Representative knowledge points | Tier | When to include |
|---|---|---|---|
| Caching & queues | Cache invalidation, TTLs, cache stampede, at-least/at-most/exactly-once semantics, dead-letter queues | Tier 2 | Backend/full-stack goals |
| Scalability | Load balancing, horizontal scaling, partitioning, replication, read/write paths | Tier 2 | Backend/infrastructure goals |
| Consistency & fault tolerance | Eventual consistency, quorums, leader election, consensus, failure detection | Tier 2–3 | Distributed-systems or infrastructure interviews |
| Observability | Metrics, logs, traces, SLOs, incident response | Tier 2 | Backend/SRE-adjacent goals |
| Cloud & deployment | Containers, CI/CD, infrastructure-as-code, cloud services | Tier 2–3 | Role-specific requirements |
| ML systems | Feature pipelines, model evaluation, serving, drift | Tier 3 | ML engineering roles only |

CMU 15-445 is a strong source for database internals, but its own syllabus notes that it assumes strong systems-programming background and covers implementation-oriented topics such as storage managers, concurrency control, recovery, query processing, and distributed/parallel alternatives.  RecallLoop should therefore use it for Tier 2 depth, not as a mandatory entry-level requirement. [csd.cmu](https://csd.cmu.edu/course/15445/s25)

***

## Deliverable F — Source-quality and content-governance policy

### Source admission

A source may enter the registry only when RecallLoop records:

- Direct canonical URL, not a search-result URL.
- Publisher, author, or responsible organization.
- Source category: specification, official documentation, academic course, textbook, employer guidance, practice resource, community report, or research paper.
- Claim scope: what the source may and may not support.
- Version/edition and publication or last-updated date.
- Retrieval date and content hash or archived snapshot where permitted.
- Access status and license/usage determination.
- Verification status: `INSPECTED`, `DISCOVERED`, `STALE`, or `BLOCKED`.

### Refresh policy

| Source type | Review cadence | Trigger for immediate review |
|---|---|---|
| RFCs / standards | Every 12 months | New RFC obsoletes or updates the cited one |
| Official language/database docs | Every 6 months | Major-version release or deprecation notice |
| University courses | Every 12 months | New semester offering or syllabus change |
| Employer guidance | Every 3 months | Careers-page change or new requisition |
| Interview-community evidence | Every 3 months | New corroborated reports or format-change signals |
| Learning-science evidence | Every 24 months | New meta-analysis or major replication debate |

### Conflict handling

1. Identify whether sources disagree about **fact**, **scope**, **version**, or **recommendation**.
2. Prefer the current normative specification for protocol/language behavior.
3. Prefer official implementation documentation for implementation-specific behavior.
4. Prefer rigorous course/textbook evidence for conceptual framing.
5. Do not manufacture consensus when sources genuinely disagree.
6. Mark unresolved conflicts as `NEEDS_REVIEW`; block autogenerated explanations that assert a single answer without qualification.

### Provenance model

Every explanation, question, rubric criterion, and correction should link to:

- One or more `source_id`s.
- The exact section, page, or version consulted.
- The claim type: `technical_fact`, `implementation_behavior`, `pedagogical_framing`, `employer_expectation`, `interview_signal`, or `learning_science`.
- Confidence: `high`, `medium`, or `low`.
- Verification status and retrieval date.

For example, an HTTP status-code explanation should cite RFC 9110, which defines shared HTTP semantics including methods, status codes, representation metadata, and content negotiation.  A PostgreSQL isolation-level explanation should cite PostgreSQL documentation, not RFC 9110. [datatracker.ietf](https://datatracker.ietf.org/doc/html/rfc9110)

### Licensing and storage

- Store bibliographic metadata, stable links, section anchors, and short original-language summaries.
- Do not bulk-copy RFC text, textbook chapters, paid course material, proprietary interview questions, or restricted question banks.
- Do not scrape LeetCode, Glassdoor, Blind, or employer sites in violation of their terms or technical controls.
- For OWASP, NIST, IETF, MDN, PostgreSQL, Python, Git, and Linux materials, verify the license on the exact asset before redistribution; public visibility is not redistribution permission.
- Prefer RecallLoop-original questions derived from public learning objectives and technical principles.

***

## Deliverable G — Implementation recommendations

### Data model separation

RecallLoop should use three linked layers rather than duplicating metadata on every question.

**1. Canonical knowledge point**

- `kp_id`: stable, immutable ID, e.g. `kp.dsa.graph.bfs`.
- `title`, `definition`, `domain`, `topic`, `subtopic`.
- `importance_tier`: Tier 0–3.
- `target_roles`, `proficiency_level`.
- `prerequisite_kp_ids`.
- `expected_knowledge`, `expected_practical_ability`.
- `reasoning_depth`.
- `misconceptions[]`.
- `real_world_applications[]`.
- `assessment_formats[]`.
- `source_refs[]`.
- `interview_evidence_refs[]`.
- `confidence`, `verification_status`, `version`, `retrieved_at`.
- `related_kp_ids`, `distinct_from_kp_ids`.
- `open_questions[]`.

**2. Assessment item**

- `item_id`.
- `kp_ids[]`: many-to-many mapping.
- `item_type`: MCQ, code, SQL, design, diagnosis, explanation.
- `difficulty`, `discrimination_target`, `estimated_time`.
- `prompt`, `options`, `starter_code`, `executable_tests`, `reference_answer`.
- `rubric[]`, `partial_credit_rules[]`.
- `originality_status`, `license_status`.
- `source_refs[]` only for claims embedded in the item.

**3. Source registry**

- `source_id`, `title`, `url`, `publisher`, `category`, `evidence_tier`.
- `domains[]`, `supported_claim_types[]`.
- `version`, `published_at`, `last_checked_at`, `content_hash`.
- `access_status`, `license_notes`, `automated_retrieval_notes`.
- `limitations[]`, `verification_status`, `confidence`.

### Integration path

1. **Do not build a parallel knowledge system.** Extend the existing canonical knowledge model with the fields above.
2. Add a **source registry service/table** first, because every knowledge point and assessment item needs traceable provenance.
3. Add a **claim-type field** so the system can distinguish “TCP provides reliable byte-stream transport” from “Amazon asks TCP questions.”
4. Add a **knowledge-point coverage report** showing, for each domain, the percentage of Tier 0/Tier 1 points having at least one verified primary source, one pedagogical source, and at least one assessment format.
5. Add a **blocked-knowledge-point state** for items lacking verified sources, ambiguous definitions, or unsupported interview-relevance claims.
6. Add **assessment validation**: every item must map to at least one knowledge point, declare its evaluation method, and specify what constitutes full, partial, and incorrect understanding.
7. Add **remediation links**: each misconception should point to a distinct remediation task and a separate verification item.

***

## Deliverable H — Highest-value next actions

### Immediate actions

1. **Create the source-registry schema and ingest the inspected anchor sources first:** RFC 9110, OWASP Top 10:2021, NIST SP 800-53 Rev. 5, Amazon SDE topics/OA pages, Microsoft technical interviewing, MIT 6.006, and CMU 15-445/645. [datatracker.ietf](https://datatracker.ietf.org/doc/html/rfc9110)
2. **Define the claim-type taxonomy**—technical fact, implementation behavior, employer expectation, interview signal, and learning-science evidence—before generating any content.
3. **Build the Tier 0/Tier 1 curriculum skeleton** for DSA, programming fundamentals, OOP/LLD, SQL, HTTP/web, OS basics, testing/debugging, Git/Linux, and secure coding.
4. **Write verification workflows** that require direct URL inspection, version capture, retrieval date, license determination, and claim-scope tagging.
5. **Create a company-evidence template** that records role level, location, interview stage, source date, direct quote/paraphrase, and evidence class; prohibit percentages without a defensible dataset.
6. **Implement knowledge-point coverage gates:** a domain cannot be marked “assessment-ready” until its Tier 0/Tier 1 points have verified sources, prerequisites, misconceptions, and at least one appropriate assessment format.
7. **Design original assessments** from knowledge-point objectives rather than copying interview questions or restricted practice-bank content.

### Later curriculum expansion

8. **Add role-specific tracks** for backend, infrastructure, mobile, frontend, data, and ML engineering after the shared core is validated.
9. **Add advanced distributed-systems material** using CMU 15-445 advanced units, MIT 6.824, and *Designing Data-Intensive Applications*, but only for learners whose target roles require it. [csd.cmu](https://csd.cmu.edu/course/15445/s25)
10. **Establish a periodic evidence-refresh pipeline** for employer pages, specifications, official documentation, and interview-community signals.
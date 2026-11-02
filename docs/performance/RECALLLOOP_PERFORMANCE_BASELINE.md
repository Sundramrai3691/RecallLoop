# RecallLoop performance and observability baseline

**Measured:** 2026-11-02 · **Scope:** local development only

## Summary

The bounded benchmark exercised the configured local PostgreSQL `recallloop` database (role `recallloop`, PostgreSQL 16.15) through the real Express API. It used 10 disposable learners, deterministic mock evaluation/remediation and local deterministic embeddings; all test accounts were removed. No learner records were selected for modification, no live provider was called, and no production capacity claim is made.

The measurements identified two backend costs worth addressing: the dashboard used five sequential queries, and session completion repeated pending-attempt loading, producing 41 pool queries per completion request in the baseline sample. Replacing the dashboard reads with one aggregate SQL statement and loading pending attempts once reduced the dashboard route to one pool query and completion to five. Under the 10-concurrency API workload, dashboard p95 fell from 52.41 ms to 21.52 ms (59%); the full study-create/retry/complete/recall workflow p95 fell from 620.23 ms to 350.14 ms (44%). These are local sample comparisons, not SLOs or capacity estimates.

## Method

The runner uses the actual API, auth, assessment, study, recall, source-ingestion, and persistence paths. It performs dashboard, goal detail, readiness, due-recall, learner-summary reads, idempotent session create/retry and completion, a five-question eligible assessment, and text/Markdown/PDF/DOCX ingestion at concurrency 1, 5, and 10. Each phase has a 10-second request timeout; the run is capped at 1,200 requests and 120 seconds and refuses non-loopback or non-`recallloop` targets. Reports contain operation names, status/latency/counts/sizes, sanitized plans, and runtime metadata, never request bodies, tokens, learner IDs, or source text.

The command is opt-in: from the repository root run `npm run performance:baseline -w server -- --out <new-report-name.json>` after the normal local database setup. It requires `RECALLLOOP_PERF_BASELINE=1`, `DATABASE_URL` explicitly configured to loopback `recallloop`, and creates a new report only under `docs/performance/results/`. On this Windows host, `tsx` fails at startup with `os.userInfo()` / `uv_os_get_passwd ENOMEM`, so the measured runs used the compiled entry after the server build: `$env:RECALLLOOP_PERF_BASELINE='1'; node server/dist/scripts/runPerformanceBaseline.js --out <new-report-name.json>`. The package script itself was not exercised here; it is the normal-host entry point. The extended workload used the same compiled runner plus `--profile=extended`, adding 10-page/40-page PDFs and a 60-paragraph DOCX. The application itself ran normally.

## Comparable API results

Percentiles are per operation and concurrency level. `p99` is withheld when the sample count is below 100. The 10-concurrency rows have 100 read requests per endpoint; workflow rows have 10 independent learner flows, so p99 is intentionally blank. All listed requests succeeded.

| Operation, concurrency 10 | Before p50 / p95 / p99 (ms) | After p50 / p95 / p99 (ms) | Change in p95 |
|---|---:|---:|---:|
| Dashboard read | 31.73 / 52.41 / 81.90 | 16.33 / 21.52 / 69.22 | -59% |
| Goal detail | 17.14 / 27.05 / 29.46 | 17.40 / 28.52 / 30.91 | +5% |
| Goal readiness | 21.62 / 34.07 / 39.30 | 22.88 / 49.61 / 62.22 | +46% |
| Due recalls | 14.25 / 25.42 / 27.24 | 10.55 / 12.84 / 13.95 | -50% |
| Learner summary | 31.78 / 65.43 / 76.70 | 25.52 / 31.60 / 33.19 | -52% |
| Study create, same-key retries, complete and recall | 611.12 / 620.23 / — | 345.41 / 350.14 / — | -44% |
| Five-question Rapid Fire flow | 898.84 / 938.94 / — | 751.32 / 766.06 / — | -18% |

The readiness row regressed in this run and is called out rather than hidden. Its API uses two pool queries at p50/p95; this work did not add an index or cache without stronger evidence. Small local workloads and run-to-run scheduling can move tail latency materially.

For visibility across all exercised concurrency levels, p95 milliseconds were:

| Operation | c1 before → after | c5 before → after | c10 before → after |
|---|---:|---:|---:|
| Dashboard | 16.85 → 17.84 | 36.46 → 33.66 | 52.41 → 21.52 |
| Study create/retry/complete/recall | 145.20 → 97.52 | 251.51 → 226.87 | 620.23 → 350.14 |
| Rapid Fire assessment submission | 335.22 → 250.94 | 497.05 → 373.12 | 938.94 → 766.06 |

The before run completed 1,076 API requests in 11.614 seconds; the after run completed the same 1,076 request profile in 10.269 seconds. Both had zero failed requests and zero timeouts. Each included 10 unique learner accounts, same-key create retries, exactly-one-session DB assertions, real assessment submissions, and ingestion. The PDF fixture was corrected during the work to split realistic text runs (the initial fixture truncated extraction); the two-page matched profile now extracts 596 characters. This means PDF-internal measurements in the earliest before artifact are not a controlled before/after comparison; backend read and study workflow request shapes are matched. The report preserves that fixture caveat.

## Query and request observations

- Dashboard changed from five sequential pool queries to one query. The before dashboard request sample had p50/p95 pool-query counts of 5/5; after it is 1/1. After dashboard request latency across 160 samples was p50 5.91, p95 22.23, p99 59.71 ms.
- Session completion changed from 41 pool queries per request (16 baseline samples) to 5 (16 after samples). After completion route latency was p50 85.81 / p95 108.73 ms; pool query duration was p50 21.51 / p95 32.34 ms.
- `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` plans in the generated reports show the due query using `idx_review_due` and `idx_recall_history_window`; idempotency lookup using `idx_study_sessions_user_idempotency_key`; and the representative latest-point evidence scan using `idx_recall_point_results_canonical`. Plans ran on a small disposable/local data set, with warm shared buffers and no shared reads in the captured plans.
- The readiness endpoint itself was timed and its request/query counts recorded. Its plan artifact is a representative latest-evidence component query, not an `EXPLAIN` of the complete readiness SQL. No production-sized query-plan inference is made.
- Structured request logs include request ID, normalized route, method, response status, duration, pool query count/time, and a pool snapshot; they omit bodies and auth headers. A bounded in-memory metrics buffer is opt-in via `PERFORMANCE_METRICS=1`. Error and ingestion/transaction events use safe categories/codes and request correlation, not provider response bodies or learner answers. Request query counts cover `pool.query`; transaction work is measured as an outer transaction duration and its client queries are not individually attributed.

## Grounded retrieval candidate regression

The retrieval regression used only a dedicated disposable PostgreSQL 16 container/database, separate from the configured application database. Its 5,121 eligible chunks included 5,005 unrelated low-ID distractors, an older relevant chunk, and a foreign learner's source. The prior recency-first 40-row window returned no relevant context; the indexed FTS query returned the relevant older chunk, and the plan used `idx_grounding_chunks_content_fts`. In the latest single run, FTS query time was 4.903 ms, application ranking 0.074 ms, total `retrieveForGap` 6.642 ms, and `EXPLAIN ANALYZE` execution 2.640 ms. These are small-fixture diagnostics, not a representative workload, production latency, or capacity estimate. Full-text search requires at least one shared query term, searches at most 64 query terms, and caps candidates at 5,000 before embedding ranking; database ranking work for common terms is not proven bounded by these output limits.

## Source-ingestion stress profile

The extended run completed 1,094 requests in 14.343 seconds without failures/timeouts. These are 10-concurrency API latencies; extraction phase timings are process-local instrumentation.

| Input | Samples | Payload bytes | API p50 / p95 at concurrency 10 (ms) | Extracted chars | Chunks |
|---|---:|---:|---:|---:|---:|
| Pasted text (~8 KB) | 32 | 8,062–8,063 | 123.62 / 158.77 | 7,972–7,973 | 8 |
| Markdown (~8 KB) | 32 | 8,074–8,075 | 101.42 / 128.55 | 7,976–7,977 | 8 |
| Small 2-page PDF | 16 | 1,499 | 80.99 / 82.20 | 596 | 2 |
| Medium 10-page PDF | 9 | 24,501 | 250.16 / 263.19 | 18,540 | 20 |
| Large 40-page PDF | 9 | 175,872 | 1,099.57 / 1,117.47 | 141,207 | 160 |
| DOCX (60 paragraphs) | 16 | 1,638–1,640 | 279.50 / 282.03 | 10,972 | 11 |

The exact per-concurrency latency distribution and byte sizes are retained in the JSON artifacts. In the extended run, phase p50/p95 (ms) were: PDF extraction 13.53/153.39; DOCX extraction 73.07/137.99; grounding persistence p50/p95 23.69/480.64 for PDF, 46.96/99.82 for DOCX, and 50.14/96.77 for text. High persistence tails under concurrent PDF ingestion merit monitoring before considering batching or background jobs. RSS rose from about 101 MiB at run start to 288 MiB after the extended run; this is only before/after process RSS, not peak memory.

## Frontend bundle

Before route splitting, the Vite entry bundle was 576.03 kB minified / 174.51 kB gzip. Lazy loading route pages reduced the entry to 429.34 kB / 137.70 kB gzip (25.5% smaller raw, 21.1% smaller gzip) and emitted separate route chunks. The real Edge/Playwright core journey passed after this change, covering direct navigation, authenticated flows, assessment, resource, and dashboard routes. The static bundle result does not measure field load time or cache behavior.

## Artifacts and limitations

- [Matched before](results/before-2026-11-02-final.json)
- [Matched after](results/after-2026-11-02-final-r3.json)
- [Extended ingestion profile](results/extended-2026-11-02-final-r2.json)

These are single local runs, not statistically repeated benchmarks. p99 is meaningful only for the larger samples; workflow p99 is suppressed. The database had only disposable benchmark data and the server ran on a Windows development host against local-container PostgreSQL. Pool wait is not separately isolated, CPU/peak memory and network bandwidth were not measured, and no production traffic mix, multi-instance load, external provider latency, or real-user latency was measured. Deterministic embedding/mock-provider timing must not be presented as Gemini performance. No production capacity or readiness claim follows from these numbers.

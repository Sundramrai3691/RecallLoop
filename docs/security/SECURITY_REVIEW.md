# Security review — 2026-11-02

## Scope and conclusion

Source review and targeted regression work covered Express authentication, production configuration, route authorization, public article SSRF controls, PDF/DOCX ingestion, error handling, HTTP headers, abuse limits, health, shutdown, SQL access patterns, dependency audit, and deployment operations. This is not a penetration test, independent audit, production deployment, or certification. The local application remains **not production-ready** until the launch blockers below are closed.

## Findings and disposition

| Severity | Finding | Disposition / evidence |
|---|---|---|
| High | Known development JWT signing secret and local DB URL could otherwise be used when production configuration omitted values. | Fixed at production startup: explicit PostgreSQL URL, non-placeholder 32+ character `JWT_SECRET`, exact HTTPS client origin, explicit live provider selectors/keys and valid expiry are required. `config:check --production` reports safe errors. No secret is printed. |
| High | The configured local application DB role `recallloop` has `rolsuper=true`, `rolcreatedb=true`, `rolcreaterole=true`, and database CREATE privilege. | Confirmed by a read-only query against `recallloop` (`172.18.0.2:5432`). No role/database changes were made. This local convenience role is unsafe for production runtime; provision and verify a least-privilege app role before any deployment. |
| High | Unknown-account login skipped bcrypt, making account lookup timing distinguishable. | Fixed by performing a cost-12 dummy bcrypt comparison for unknown accounts. Same 401 code/message remains for missing account and wrong password. Unit regression checks the dummy-hash path. Timing is reduced, not formally proven constant-time. |
| High | Costly/automatable login, registration and ingestion paths had no local admission bounds. | Added per-process fixed-window auth limits (30 per IP/route per 15 minutes), study creation limit (30 per IP/operation per 15 minutes), recall submission limit (60 per IP/operation per 15 minutes), and three concurrent ingestion slots per process. Tests cover limit, reset, forwarded-IP spoof resistance, stable operation scope and admission release. Multi-instance ingress limits remain required. |
| Medium | API emitted no explicit browser hardening headers; health reported success without checking PostgreSQL. | Added nosniff, frame denial, referrer and permissions headers. Liveness is DB-independent; readiness checks `SELECT 1` and returns sanitized 503 on failure. Actual app route/header/auth tests and Edge E2E through production preview cover the behavior. CSP/HSTS belong at the frontend/reverse proxy. |
| Medium | `22P02`, uniqueness and foreign-key errors were treated as opaque 503/500 failures. | Fixed safe mappings to 400 invalid identifier and 409 conflict/reference; only connection/service failures map to 503. Regression tests assert response messages/codes do not expose SQL or DB details. |
| Medium | Shutdown waited without a deadline and could leave the process hanging on open requests. | Added a bounded 10-second HTTP drain, force-close at deadline and separately bounded DB pool close. Unit tests cover normal drain, forced deadline and DB close timeout. |
| Low | JWT algorithm policy relied on library defaults. | Signing now explicitly uses HS256; verification allowlists HS256. Tests reject malformed, expired and unsupported-algorithm tokens. |

## Controls verified in source

- **Identity/ownership:** bcrypt password hashes; signed expiring bearer JWT; authenticated route groups; services/repositories bind private rows to `req.user.id`; non-disclosing source lookups. Existing PostgreSQL integration tests exercise owner isolation across source, study and evidence paths. The current full integration command was not run because its setup always runs migration and canonical question seeding, prohibited for this milestone.
- **Web SSRF:** public HTTP(S) only on standard ports; rejects credentials, local/private/reserved IPv4, localhost and IPv6 literals; resolves all DNS answers; rejects mixed public/private results; pins a validated public IPv4 at connection; follows at most three redirects with revalidation; bounds 8-second request and 2 MB body. Existing tests cover private/mixed DNS, redirects, URL shapes, content type and size. No live external fetch was performed.
- **Files:** authenticated raw upload, 10 MiB cap, PDF page/text caps, DOCX entry/expanded-size/path/part/text checks, malformed/empty failure states and bounded per-process parsing admission. Existing parser tests cover oversized, malformed, archive traversal/limits and no-text input. No OCR or new parser path was added.
- **HTTP/XSS:** React escapes string content; source inspection found no `dangerouslySetInnerHTML`; external links use `rel=noreferrer`; CORS allow-origin is a configured static value and does not reflect caller input; auth uses bearer headers, not cookies. No CSP is supplied by the API because it does not serve the client HTML.
- **Data access:** repository values are bound parameters in inspected queries; transaction helpers rollback on errors; PostgreSQL pool is capped at 10. The local role privilege audit is complete and confirms the configured role is superuser; no production role audit exists. A complete formal SQL static analysis was not performed.
- **Errors/logs:** API returns generic 500 and safe DB failure responses; structured error/request logs avoid bodies, passwords, tokens and environment values. Provider errors are sanitized by the existing adapters. Logs still require restricted operational access.
- **Configuration:** production fail-fast checks; `.env.example` remains a mock/development template and contains no usable provider key. The real local config intentionally fails the production preflight.

## Commands and outcomes in this milestone

| Check | Result |
|---|---|
| Focused security/auth/config/SSRF/PDF/DOCX tests | Passed: 12 files, 40 tests after correcting a CORS test to model browser origin comparison accurately. |
| Full server unit suite | Passed on final run: 46 files, 213 passed, 4 opt-in provider checks skipped. |
| Server TypeScript build | Passed. |
| Edge core E2E | Passed after correcting an initial test-order issue (header fetch ran on `about:blank`). Final pass used configured loopback PostgreSQL through the real API and production client preview; covers authenticated learner flows, response-loss reconciliation, ingestion, assessment, remediation, readiness, auth lifecycle and page behavior. API security headers are asserted through the preview proxy. No live provider request. |
| Development config preflight | Passed via `node dist/scripts/checkConfig.js`; emitted the expected development JWT-default warning and non-secret provider identifiers. `npm run config:check` itself fails before script startup due this host's Node 24 `uv_os_get_passwd ENOMEM` in `tsx`. |
| Production config preflight | Correctly rejected the actual development DB URL, default/absent acceptable JWT secret, and non-HTTPS local client origin. Run through the built JS entry to bypass the `tsx` host failure. This is evidence that production readiness is not met on this machine. |
| Production dependency audit | `npm audit --omit=dev --offline --json`: zero reported production advisories. |
| Full dependency audit | Not available: npm advisory endpoint could not be reached. No all-dependency zero-vulnerability claim is made. |
| PostgreSQL integration | Not run: the existing integration `beforeAll` runs migrations and `seedCanonicalQuestionBank()`. The brief explicitly prohibits question-bank seeding. Prior 22/22 result is historical, not current security-milestone validation. |
| `git diff --check` | Passed after the final implementation and documentation edits; only standard Git line-ending notices were reported. |

## Remaining launch blockers

1. Replace the local superuser application role pattern with a least-privilege production runtime role (no superuser, CREATEDB, CREATEROLE or schema ownership beyond required privileges), use a separate migration role, and verify effective grants read-only.
2. Supply production DB, random JWT secret, HTTPS origin, live-provider keys, and proxy configuration; run production preflight in the intended deployment environment.
3. Configure ingress-wide rate/connection/body limits and network egress restrictions. In-process limits do not coordinate replicas.
4. Set and validate frontend CSP/HSTS at the actual static host/reverse proxy; test the deployed bundle.
5. Verify the production database runtime role uses encrypted transport.
6. Establish encrypted automated backups, RPO/RTO and complete an isolated restore drill.
7. Obtain a reachable full dependency advisory audit and review any findings.
8. Run PostgreSQL integration tests only in a disposable isolated DB or after the explicit no-seeding constraint is lifted; current integration bootstrap seeds canonical question data.
9. Validate multi-instance limits, observability/alerting, provider data-processing terms, and operational incident ownership on the actual deployment platform.

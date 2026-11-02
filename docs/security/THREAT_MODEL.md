# RecallLoop threat model

Status: source review of the checked-out application, 2026-11-02. This is an engineering threat model, not a penetration test or certification.

## System and trust boundaries

- Browser (React/Vite) sends JSON and document bytes to the Express API. The API allows the configured `CLIENT_ORIGIN`; bearer JWTs are stored by the client and sent in `Authorization` headers (`client/src/api/client.ts`, `client/src/auth/*`).
- Express routes/controllers validate request shapes, services apply domain and ownership rules, repositories issue parameterized PostgreSQL queries, and PostgreSQL stores accounts, source material, questions and learner evidence (`server/src/app.ts`, `server/src/routes/index.ts`, `server/src/controllers`, `server/src/services`, `server/src/repositories`).
- Anonymous entry points are registration, login, and health. Learning, account, resource and evidence APIs are mounted behind route-level `requireAuth` middleware. Shared catalog/question-bank reads are distinguishable from owner-scoped learner rows.
- Resource ingestion accepts learner text and supported TXT/Markdown, PDF, DOCX and public HTML inputs. Public article fetch is a server-side network boundary. LLM/embedding providers receive selected user material and answer/evaluation context through configured adapters; provider availability is external.
- There is no background worker/queue. Parsing, embedding, and provider-dependent work occurs in request handling.
- Startup validates production configuration, probes PostgreSQL, and serves the API. Migrations and curated seed replay run through an explicit command, not application startup (`server/src/index.ts`, `server/src/db/migrate.ts`).

## Assets

Account credentials and signing key; authenticated tokens; private study notes and imported documents; source chunks and embeddings; goals, assessments, recall attempts, remediation, readiness and scheduling state; canonical question-bank revisions/review records; PostgreSQL availability and integrity; provider credentials; backups and operational logs.

## Threat scenarios and controls

| Threat | Exposure / impact | Existing control and evidence | Residual risk / priority |
|---|---|---|---|
| Stolen/forged/expired token | Account and learner-evidence access | Passwords use bcryptjs cost 12; JWT uses HS256 allowlisting and expiration; routes require bearer auth; production startup rejects missing/default JWT secret. Login has generic failure text and dummy bcrypt work for unknown accounts. | Bearer token is held in browser local storage; XSS could read it. Tokens are stateless and logout only clears the browser token. Rotate signing secret to revoke all issued tokens. **High** |
| Cross-learner object reference | Private sources, sessions, evidence or goals disclosed/changed | Ownership is derived from verified token and included in repository/service predicates; integration tests cover cross-owner source, assessment, remediation and readiness cases. Missing/foreign resources use non-disclosing not-found behavior on covered routes. | Continue adding owner-scoped tests whenever endpoints are added. **High** |
| SSRF via article URL or redirect | Access to loopback, cloud metadata, private services | `webArticleExtractor.ts` restricts HTTP(S), standard ports, rejects local/private/reserved IPv4 and IPv6 literals, resolves all DNS answers, pins the checked public IPv4 at socket connection, bounds redirects/time/body and revalidates redirects. Unit tests cover private/mixed answers and redirects. | IPv6-only public sites are intentionally unsupported. Validate behavior from deployed network because egress policy is outside app. **High** |
| Malicious/oversized file | CPU/memory exhaustion or partial source | Raw uploads are auth-gated and capped at 10 MiB; parser limits bound PDF pages/text and DOCX ZIP entries/expanded bytes/text; malformed/empty extraction persists non-eligible failure; ingestion concurrency is capped per process. Unit/integration tests cover malformed, oversized, scanned and archive limits. | CPU/memory limits are process-local; isolate containers and set memory/CPU limits. No OCR. **High** |
| Request flooding / account enumeration | Login/registration abuse, provider spend or service exhaustion | Login/register fixed-window limits, per-process key bounds, ingestion concurrency admission, JSON/body/parser limits, provider timeouts, database pool cap. Unknown account and wrong-password errors are uniform. | Limits are per process, reset on restart and do not coordinate across replicas. Apply ingress-wide rate/connection limits for multi-instance deployment. Expensive authenticated assessment/LLM endpoints have no global quota. **High** |
| SQL injection | Arbitrary data access or mutation | Repository queries use PostgreSQL positional parameters for user values. Dynamic SQL is limited to fixed internal clauses; migration/seed code is trusted repository code. | Review new raw SQL during changes. A full static SQL audit was not performed. **Medium** |
| XSS/clickjacking/cross-origin use | Token theft or unsafe learner content rendering | React renders strings as text; repository search found no `dangerouslySetInnerHTML` use. API adds nosniff, frame denial, referrer and permissions policy. CORS is restricted to configured origin; external links use `rel=noreferrer`. | No CSP is emitted by API; static frontend/reverse proxy must set a CSP tested against the built app. localStorage remains exposed to same-origin script. **Medium** |
| Secrets or provider/internal errors leak | Credential compromise or infrastructure disclosure | Production config check reports only errors/identifiers; unhandled errors are sanitized; request telemetry excludes auth/body; startup failures emit safe codes. `.env` is ignored and not modified. | Operators must use a secret manager, redact platform logs, rotate secrets, and never capture authorization headers/body. **High** |
| DB outage, shutdown, bad migration | Failed writes or prolonged outage | Health separates liveness/readiness; DB errors return safe 503; startup probes DB; graceful shutdown stops acceptance, waits to deadline, then closes connections and pool. Migrations are explicit. | No migration ledger or automatic rollback; forward-fix and restore process must be practiced outside production. **Medium** |
| Backup theft or unusable recovery | Permanent data loss / privacy breach | Backup and restore procedures are documented in `docs/operations/DATABASE_BACKUP_AND_RESTORE.md`. | No restore drill or production backup evidence exists. **High launch blocker** |

## Security testing evidence

The security milestone adds focused tests for JWT expiry/algorithm rejection, production config, uniform login path, rate limiting/admission, response headers, safe malformed-ID/database errors, DB-backed readiness failure, and bounded shutdown. Existing suites contain owner-isolation, SSRF/DNS/redirect, file parser and extraction-failure coverage. See `docs/security/SECURITY_REVIEW.md` for exact execution outcomes.

## Trust assumptions

Production terminates TLS at a trusted reverse proxy, configures `TRUST_PROXY_HOPS` exactly, restricts database network access, supplies least-privilege credentials, and stores secrets/backups outside the repository. Automated question review, tests and source review do not establish penetration resistance, model quality, or production readiness.

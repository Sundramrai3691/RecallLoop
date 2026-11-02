# Deployment runbook

This documents a deployment procedure; RecallLoop has not been deployed or penetration-tested by this work.

## Preconditions

- Node.js `>=22.13.0`; PostgreSQL 16 is the validated local major version.
- Private managed PostgreSQL with network access limited to app/migration hosts, TLS where supported, backups and monitoring.
- A dedicated least-privilege runtime role with only required table/sequence access; it must not be superuser, CREATEDB, CREATEROLE, or own the database/schema. Use a separate migration principal for DDL/seed deployment.
- HTTPS reverse proxy or static host for the Vite client. The API CORS allowlist is one configured `CLIENT_ORIGIN`.
- Production environment passes `npm run config:check -w server -- --production`; use secret-manager injection for DB/provider credentials and a random `JWT_SECRET`.
- Decide the ingress-wide request, connection and upload limits. Application auth rate limit and ingestion concurrency are per process and do not coordinate across replicas.

## Release procedure

1. Build an immutable artifact from the reviewed commit using the lockfile (`npm ci`, then `npm run build`). Do not install development dependencies into the runtime image unless required for build; copy only runtime artifacts and production dependencies into the final image.
2. Run safe configuration preflight in the release environment. Do not echo env values.
3. Take and verify a pre-release database backup as described in [Database backup and restore](DATABASE_BACKUP_AND_RESTORE.md).
4. Run `npm run db:migrate -w server` once as a deployment job using the migration principal, before rolling out API instances. Do not run it independently in each replica. The ordered runner applies migrations and curated catalog seed SQL; review its scope and expected idempotent data changes before execution. Application startup does not run migrations; it probes PostgreSQL with `SELECT 1` and exits on failure.
5. Start the built API with `npm start`. Run exactly one migration job per release; there is no migration ledger table and no automatic rollback. If migration fails, stop rollout, retain logs, inspect transaction outcome, and use a reviewed forward fix or restore plan; do not edit an already deployed migration.
6. Serve the client bundle at the exact HTTPS `CLIENT_ORIGIN`. Terminate TLS at a trusted proxy. If proxy headers are used, set `TRUST_PROXY_HOPS` to the exact hop count; never trust arbitrary forwarded headers.
7. Apply CSP and HSTS at the HTTPS frontend/proxy after validating against the built client and API routes. API sets nosniff, frame denial, referrer and permissions headers. Do not enable cross-origin credentials; bearer auth is used, not cookies.
8. Probe `GET /api/health/live` for process liveness and `/api/health/ready` for DB readiness. Both return minimal data; readiness is 503 on DB failure. Alert on readiness failure and sanitized `server.startup_failure` / `http.error` events.
9. On SIGTERM/SIGINT, the API stops accepting connections, allows up to 10 seconds for in-flight requests, closes remaining connections, and bounds DB pool shutdown. Configure orchestrator termination grace period above the app deadline.
10. After rollout, verify health, one authenticated smoke flow with a disposable account if permitted, database connection capacity, error rates, and backup job success. Never test with real learner evidence.

## Rollback and recovery

Application artifact rollback is safe only when the previous version is compatible with the already-applied additive schema. No automatic down migrations are provided. Prefer a forward fix. Restore a backup only under an incident plan to a separately verified target; restore can discard newer learner writes and needs an explicit recovery-point decision. See backup and incident runbooks.

## Unverified launch controls

No production deployment, live-provider reliability, multi-instance rate-limit test, CSP/browser compatibility test on a hosted deployment, least-privilege production role, backup job, or restore drill is claimed. The current local `recallloop` role was confirmed to be a superuser; replace that role pattern for production and close these controls against intended infrastructure before launch.

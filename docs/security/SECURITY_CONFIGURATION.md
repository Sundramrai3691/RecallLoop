# Security configuration

Use a secret manager or deployment platform environment injection. Do not commit `.env`, print secret values, expose secrets with `VITE_*`, or paste keys into logs/issues. `.env.example` is a development template, not a production configuration.

## Production requirements

Set `NODE_ENV=production`, explicit `DATABASE_URL` (PostgreSQL URL), `JWT_SECRET`, exact HTTPS `CLIENT_ORIGIN`, explicit live provider selectors and their required API keys, and `JWT_EXPIRES_IN` with an explicit positive unit. The current supported live selectors are `LLM_PROVIDER=openai-compatible`, `EMBEDDING_PROVIDER=openai-compatible`, and `REMEDIATION_PROVIDER=llm`. Provider base URLs must be HTTPS. Never select mock providers in production. `PORT` must be 1–65535. Set `TRUST_PROXY_HOPS` only to the exact trusted proxy count; default is zero.

Generate a JWT signing key directly in the target secret manager or private operator terminal (do not write it into source control):

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

The startup check applies to every mode other than `development` and `test`, including staging. It rejects missing/local/default DB configuration, short/placeholder/low-diversity JWT secrets, non-HTTPS client/provider origins, mock providers, missing selected-provider keys, malformed expiry and invalid port/proxy values. It runs before the DB connection. A JWT secret rotation invalidates all current bearer tokens because token revocation lists are not implemented.

## Safe preflight

```powershell
npm run config:check -w server
npm run config:check -w server -- --production
```

The first reports the selected runtime mode; the second validates production requirements without making provider calls or displaying credential values. It may intentionally fail on a development machine. Resolve errors in the deployment secret/configuration store, not by weakening the checks.

## Other operational settings

- PostgreSQL pool is bounded in `server/src/db/postgres.ts`; keep DB credentials private and grant only application runtime DML/sequence privileges on required tables. Use a separate migration principal for schema/seed operations where the deployment supports it. The application does not need superuser privileges.
- JSON request body limit is 1 MiB. PDF and DOCX raw uploads are each limited to 10 MiB and require authentication. Ingestion admission and auth request limits are process-local; place a global limiter at the ingress for multi-instance production.
- CORS accepts the configured client origin. Serve the client over HTTPS and set CSP at its static host/reverse proxy. Verify the policy against the production bundle; do not add `unsafe-eval` without a measured requirement.
- Keep `REQUEST_LOGS` free of payload/credential logging; set it to `0` only if request logging must be disabled, not as an error-hiding mechanism.
- Do not include credentials in URLs passed to support or monitoring systems. Protect dumps as sensitive learner data and encrypt them at rest and in transit.

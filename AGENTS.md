# Agent instructions

## Repository boundaries

- This is the RecallLoop npm workspace: `client` is React/Vite and `server` is Express/TypeScript with PostgreSQL. Keep API contracts, ownership checks, and database migrations consistent across both packages.
- Treat `server/migrations` as the deployed schema history. Add an additive migration for schema changes; do not silently edit old migrations or infer the live database from TypeScript types.
- Derive the authenticated owner from the request's verified user identity. Never trust a client-supplied `user_id`.
- Keep domain decisions in services, SQL in repositories or established service queries, request parsing in controllers, and shared contracts in the existing types. Follow the existing structure unless a change requires a documented exception.
- Keep LLM output untrusted: validate structured output before domain code persists it. Preserve deterministic mock behavior for local development.
- Do not add credentials, real learner data, or generated secrets to tracked files.

## Documentation contract

Before changing behavior, read the relevant entry in `docs/README.md` and inspect the implementation and migrations. After a behavior, API, schema, product-scope, or architectural change, update the relevant documentation in the same change:

- API/call-chain or transaction change: `docs/FLOW.md`.
- Persistence, constraints, ownership, or migration change: `docs/DATA_MODEL.md`.
- Durable cross-cutting design choice: `docs/DECISIONS.md` and an ADR when useful.
- Feature delivery or verification state: `docs/PROJECT_STATUS.md`.
- Work session: append a dated entry to `docs/SESSION_LOG.md`; do not rewrite previous entries.
- User-facing design system: `docs/FRONTEND_DESIGN.md`.

Document observed behavior, not intended behavior. Mark uncertain or reconstructed history as such. Do not invent owners, dates, discussions, test outcomes, or deployment state. Preserve existing useful domain documents and link to them rather than replacing them with summaries.

## Local commands

- `npm run dev` starts the API and Vite client; API startup requires PostgreSQL at `DATABASE_URL`.
- `npm run db:migrate -w server` applies the repository's migration sequence; `npm run db:seed -w server` seeds curated knowledge.
- `npm run build` builds both workspaces. `npm test` runs server unit tests; `npm run test:integration -w server` requires PostgreSQL.
- In the final report, state the commands actually run and distinguish failures caused by missing local services from code failures.

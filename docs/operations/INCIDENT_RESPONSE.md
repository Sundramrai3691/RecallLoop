# Incident response

Use this runbook for suspected account compromise, cross-learner access, exposed credentials, malicious ingestion, provider abuse, database outage/corruption, or backup failure. Preserve evidence and avoid speculative cleanup.

## First response

1. Record incident time in UTC, reporter, affected environment, observed request IDs and symptoms. Do not copy passwords, bearer tokens, provider keys, source text, or full learner answers into tickets.
2. Identify the affected service, deployment, database and account scope from trusted platform metadata. Preserve sanitized logs, deployment/image identifiers and relevant access-control events under restricted access.
3. For active abuse, use the infrastructure ingress to block or rate-limit the source/route and, if needed, temporarily disable affected ingestion/provider operations. Do not disable authentication or ownership checks.
4. Notify the designated service/security/data owner through the organization's incident channel. This repository does not define an on-call owner or legal notification deadlines; follow applicable organizational and jurisdictional policy.

## Credential or token exposure

- Revoke/rotate the exposed provider/database credential at its issuer, then update secret-manager values and redeploy.
- JWTs are stateless and cannot be individually revoked. Rotate `JWT_SECRET` to invalidate all active bearer tokens; expect all learners to sign in again. Preserve the old secret only as required by a controlled incident investigation, never in general logs.
- Review access logs for affected account/endpoint/time ranges. Avoid logging or exporting token values.

## Suspected data exposure or integrity incident

- Restrict access at the gateway/database while preserving service evidence. Use owner-scoped read-only queries to determine affected row identities and time range; do not delete, merge, or rewrite historical learner evidence during triage.
- Preserve database backups/snapshots and logs before repair. Record exact query, target identity and reviewer for any approved change.
- If corruption is confirmed, choose a recovery point with the data owner; restore to a separately verified target first and compare before any production cutover.
- For provider failure or malformed evaluation, keep failed submissions pending and use existing retry/reconciliation behavior. Do not insert synthetic outcomes.

## Availability and recovery

- Check `/api/health/live`, `/api/health/ready`, PostgreSQL service/pool capacity, and sanitized API error codes.
- For shutdown/migration incidents, capture deployment and migration command output. Migrations run as a separate job; do not launch repeated concurrent migration jobs or edit migration history. Prefer a reviewed forward-fix.
- Follow [Database backup and restore](DATABASE_BACKUP_AND_RESTORE.md) for recovery. Verify the target and backup before restore; never use the learner database for a restore drill.

## Closure

Record impact, timeline, confirmed root cause, containment, recovery point, data changes, user communications required by policy, and follow-up controls. Update tests/docs for reproduced defects. Do not state “no impact” without evidence; do not claim certification or a successful restore without a completed drill.

# PostgreSQL backup and restore

Backups contain credentials, learner notes, source extracts, assessment answers and private evidence. Restrict access accordingly. These are operator procedures, not commands executed during this milestone.

## Backup

Use a PostgreSQL client version compatible with the server and inject the password through a managed secret or protected `PGPASSFILE`; do not put passwords on the command line or in shell history. Run from a controlled host with network access:

```powershell
$env:PGPASSFILE = '<private path to protected pgpass file>'
pg_dump --host=<db-host> --port=5432 --username=<backup-role> --dbname=<database> --format=custom --no-owner --file=<private output path>/recallloop-<UTC timestamp>.dump
pg_restore --list <private output path>/recallloop-<UTC timestamp>.dump
```

Use a role authorized to read all required application data and schema. Encrypt the dump with an approved KMS/encryption tool before transfer or archival; store the encryption key separately. Restrict file permissions, record timestamp/size/checksum, transfer over TLS, and apply a documented retention policy (for example daily short-retention plus longer periodic copies) appropriate to the service's recovery objectives. Test that backup automation fails loudly on exit-status or empty-file errors.

## Restore drill or incident restore

Never restore over the current configured database as a test. Provision a separately isolated scratch PostgreSQL database/instance, verify its host, database name, role and empty/scratch ownership before any create/drop/restore command. If isolation cannot be proven, document the unperformed drill and stop.

1. Verify dump checksum, encryption, expected timestamp and PostgreSQL compatibility.
2. Confirm scratch target identity with `SELECT current_database(), current_user, inet_server_addr(), inet_server_port(), version();` and ensure it is not the application or production target.
3. Create a scratch database and least-privilege restore role using the infrastructure owner's approved process; do not use superuser credentials in the application.
4. Decrypt into a restricted temporary directory and restore with `pg_restore --no-owner --exit-on-error --dbname=<verified-scratch-target> <dump>`.
5. Verify tables, constraints, migration-dependent schema, row counts for selected non-sensitive aggregates, foreign-key validity, and application health using a scratch-only configuration. Compare expected migration state from deployment records because the application schema has no migration ledger table.
6. Run a documented application smoke check only against scratch. Record restore duration, errors, data timestamp and observed recovery point.
7. Dispose of scratch data using the infrastructure's approved secure cleanup, including decrypted temporary files and keys where applicable. Do not delete shared volumes or assume a target alias is scratch.

## Recovery limitations

There is no demonstrated production backup schedule, RPO/RTO, point-in-time recovery configuration, or completed restore drill. PostgreSQL major-version/extension compatibility, provider credentials, uploaded-source availability and encryption-key recovery must be planned. Restoring a backup rewinds learner evidence to its snapshot and may require a deliberate reconciliation plan.

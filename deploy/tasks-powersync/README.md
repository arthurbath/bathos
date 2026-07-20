# Tasks PowerSync Deployment

This package prepares the remote synchronization boundary for the private Tasks parallel-use trial. It is safe to keep in the public repository because it contains no database password, service token, private endpoint credential, or personal task content.

Production provisioning remains unapproved. Do not run a database or PowerSync mutation from this package until the user approves the Supabase plan and PowerSync Cloud privacy boundary recorded in `docs/agents/evaluations/2026-07-20_tasks_production_sync_topology.md`.

## Files

- `sync-config.yaml` is the canonical owner-scoped PowerSync stream.
- `database-role.sql` creates or rotates the dedicated least-privilege replication login using a password supplied through the process environment.
- `publication-create.sql` creates the required fresh `powersync` publication.
- `publication-update.sql` replaces the table set of an existing Tasks-only publication without dropping its replication slot.
- `verify.sql` fails unless the role, publication, RLS, replica identity, grants, and exact table set match the approved contract.
- `service.self-hosted.example.yaml` preserves the later self-hosting option without selecting it.

The repository test `src/modules/tasks/sync/deploymentConfig.test.ts` keeps these files, the browser client schema, and the disposable integration harness synchronized.

## Approval Preconditions

1. Reconfirm that the BathOS project remains in the Pro organization verified on 2026 Jul 20 and review any incremental replication billing shown by the dashboard.
2. Approve PowerSync Cloud as an additional processor of personal task data.
3. Create or sign in to the owner's PowerSync account.
4. Select a US-region development instance for the bounded parallel-use phase.
5. Take a current Supabase database backup and record a rollback owner before changing replication state.

Do not upgrade a billing plan, create an external account, add a processor, or alter the production database merely because this runbook exists.

## Database Preparation

Use the Supabase direct database connection. A pooler connection cannot support logical replication. Keep its URL and the generated role password outside the repository and terminal transcript.

Generate a high-entropy password in a secure password manager, expose it only as `TASKS_POWERSYNC_DATABASE_PASSWORD` for the role command, and clear it immediately afterward. Run `database-role.sql` through `psql` as the Supabase database owner.

Inspect existing publications before continuing:

```sql
SELECT pubname, schemaname, tablename
FROM pg_publication_tables
ORDER BY pubname, schemaname, tablename;
```

Use `publication-create.sql` only when `powersync` does not exist. Use `publication-update.sql` only after proving an existing `powersync` publication belongs exclusively to this Tasks deployment. The update intentionally removes unapproved tables from that publication.

Run `verify.sql` before giving PowerSync the database connection. Its final row must report `ready` and 22 synchronized tables.

## PowerSync Cloud Configuration

1. Connect the development instance to the direct Supabase database using `tasks_powersync_role`, its managed password, and `verify-full` TLS.
2. Enable Supabase Auth. Prefer the project's asymmetric JWKS endpoint and do not store a legacy JWT secret when automatic Supabase detection succeeds.
3. Deploy `sync-config.yaml` exactly as committed.
4. Confirm the instance reports a healthy source connection and no inactive or rapidly growing replication slot.
5. Keep the service endpoint in a protected deployment preview at first. The endpoint is client-safe, but publishing it before synthetic validation would create a misleading production path.

## Synthetic Acceptance Gate

Supply the production Supabase URL, publishable key, service-role key, and PowerSync endpoint to the test process through managed environment variables. The service-role key exists only so the test can create and delete its two synthetic accounts. It must never be committed, printed, or placed in `.env`.

```sh
TASKS_PRODUCTION_TEST_CONFIRM=synthetic-only \
TASKS_PRODUCTION_TEST_SUPABASE_URL=https://PROJECT.supabase.co \
TASKS_PRODUCTION_TEST_SUPABASE_KEY=PUBLIC_PUBLISHABLE_KEY \
TASKS_PRODUCTION_TEST_SERVICE_ROLE_KEY=MANAGED_SECRET \
TASKS_PRODUCTION_TEST_POWERSYNC_URL=https://POWERSYNC_INSTANCE \
npm run test:tasks:production-topology
```

The gate creates two synthetic owners, proves owner isolation, exact Raycast capture retry, two-client download, offline-web versus MCP conflict convergence, exactly-once completion, persisted-client restart, authoritative history counts, and account-cascade cleanup. It refuses to run without the exact confirmation value. Its emergency cleanup attempts every database, session, user, and temporary-directory step even after an earlier failure, and fails conspicuously if any cleanup step leaves uncertain residue.

After it passes, independently confirm that the two synthetic users and their task rows are absent. Only then add the public HTTPS endpoint as `VITE_TASKS_POWERSYNC_ENDPOINT` to the intended BathOS deployment and repeat a browser-level acceptance pass with synthetic data.

## Operational Boundaries

- Monitor connection health, replication slot activity, retained WAL, upload queue depth, download errors, and conflict receipts.
- A PowerSync outage must leave local task work available and visibly offline.
- Never publish `tasks_web_push_subscriptions`, Mail source lifecycle tables, or another BathOS module through this stream.
- Any task schema addition must update the client schema, canonical stream, database role grant, publication, disposable harness, and drift test together.
- PowerSync Cloud Free is a parallel-use topology, not an authoritative-service decision.
- Do not connect Inbox Manager or migrate Things data as part of deployment.

## Rollback

If synthetic validation fails, remove the preview endpoint first so no new client connects. Preserve local SQLite files and capture the content-free failure evidence. Stop or detach the PowerSync instance before removing its replication slot, publication, or role. Database cleanup is a separately approved production action and must use the exact identifiers verified above.

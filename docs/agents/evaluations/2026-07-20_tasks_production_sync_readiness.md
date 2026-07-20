# Personal Tasks Production Sync Readiness

**Date:** 2026-07-20
**Category:** Trust / Deployment / Security
**Status:** Prepared Locally, Production Approval Pending

## Purpose

Turn the validated disposable PowerSync topology into a production-ready, secret-free deployment package without creating an external account, changing billing, or mutating production. The work also audited whether every nonlocal client collection could actually download through the existing stream and publication.

## Defect Found

The PowerSync client schema contained 22 synchronized tables, but the disposable owner stream and publication contained only 16. Six server-generated recurrence and reminder collections had been added to the browser schema without being added to the download boundary:

- `tasks_recurrence_evaluations`
- `tasks_recurrence_status_events`
- `tasks_reminder_occurrences`
- `tasks_delivery_targets`
- `tasks_reminder_deliveries`
- `tasks_reminder_claims`

The five reminder-domain tables also lacked `REPLICA IDENTITY FULL`. A connected client could therefore miss server-generated recurrence and reminder receipts even though direct service operations succeeded. Updates or removals in the reminder projection also lacked the complete old-row identity required by the owner-scoped replication contract.

## Correction

- Expanded the canonical and disposable owner streams to all 22 synchronized tables.
- Expanded the disposable and production publication definitions to the same exact set.
- Added full replica identity for every synchronized reminder table through a forward migration.
- Added a dedicated `tasks_powersync_role` script that accepts its password only through the process environment, requires at least 32 characters, grants replication and bypass-RLS without superuser or database-creation powers, and grants SELECT only on the approved task projection.
- Added create and update publication paths so a fresh deployment does not need to drop a publication or replication slot.
- Added a database preflight that rejects table-set drift, missing RLS, missing full replica identity, unsafe role attributes, missing grants, explicit non-task grants, and server-only task tables.
- Added a self-hosting fallback template with managed environment secrets and `verify-full` TLS.
- Added a production-topology acceptance test that refuses to run without explicit synthetic-only confirmation and deletes both synthetic owners through a managed service-role client.
- Hardened the acceptance test's emergency cleanup so an earlier assertion failure still attempts every local database, synthetic session, synthetic owner, and temporary-directory cleanup, then reports every cleanup failure instead of silently leaving uncertain production residue.

## Regression Boundary

`deploymentConfig.test.ts` derives the authoritative synchronized table set from the actual PowerSync client schema. It requires exact agreement across:

- The canonical production Sync Streams file
- The disposable integration Sync Streams file
- Fresh and existing production publication scripts
- The disposable publication script
- The database-role grants
- The database preflight expected set

It also requires the complete owner predicate on every query, forbids joins and `FOR ALL TABLES`, proves the disposable and production stream files are byte-identical, and rejects embedded passwords or self-hosted database connections without verified TLS.

## Local Validation

- TypeScript and focused ESLint passed.
- Four deployment-configuration tests passed.
- All 21 database test files and 574 assertions passed after a clean migration replay.
- The role script created the bounded replication login in the disposable database.
- The Tasks-only publication created successfully.
- The database preflight reported `ready` with exactly 22 synchronized tables.
- The production-style acceptance gate passed in 2.674 seconds against local Supabase and PowerSync.
- Two local replicas for one synthetic owner received the same accepted task, conflict winner, completion, history, recurrence, and reminder state.
- Both replicas received one row from each of the six repaired server-generated collections.
- A second synthetic owner received zero task or receipt rows and could not mutate the first owner's task.
- Restarting one persisted replica retained the accepted completed task.
- Deleting the two synthetic accounts removed the authoritative task and dependent records.

## Security Boundary

The stream publishes no Web Push subscription endpoint or encryption key, no normalized Mail source lifecycle table, and no other BathOS module. The public repository contains no production database URI, replication password, PowerSync account token, service-role key, or personal task content.

The replication role must use `BYPASSRLS` because PowerSync reads the source independently of an end-user session. Owner-scoped Sync Streams are therefore a security-critical peer of RLS. The exact-set regression test and database preflight make that duplicated boundary explicit and reviewable.

## Remaining Approval

No production state changed. Production work still requires confirmation of Supabase external-replication eligibility and explicit approval to add PowerSync Cloud as a processor of personal task data. The permanent module name, launcher registration, Inbox Manager dual-writing, and migration remain separate decisions.

## Evidence

- `deploy/tasks-powersync/`
- `src/modules/tasks/sync/deploymentConfig.test.ts`
- `src/modules/tasks/integration/productionTopology.integration.test.ts`
- `supabase/migrations/20260720182000_set_tasks_reminder_replica_identity.sql`
- `supabase/tests/database/tasks_reminders.test.sql`

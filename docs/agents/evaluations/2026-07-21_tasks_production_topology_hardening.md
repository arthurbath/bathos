# Tasks Production Topology Hardening

**Date:** 2026-07-21
**Category:** Security / Performance / Operations
**Status:** Production Accepted

## Outcome

The approved Tasks hardening package is active in production. Six migrations applied exactly, the reminder dispatcher advanced from version 1 to version 2, the PowerSync boundary verifies as ready with exactly 22 synchronized tables, and the synthetic cross-client topology gate passed with complete cleanup.

The deployment does not activate Inbox Manager dual-writing, native Apple work, migration from Things, or any broader production data mutation.

## Production Changes

- Applied the six pending Tasks migrations through the linked Supabase migration history
- Optimized reminder RLS owner checks to use initialization plans without weakening owner predicates
- Hardened browser-subscription, privileged network, destructive confirmation, recurrence cursor, replace preview, PowerSync function access, and template capture boundaries
- Redeployed `dispatch-task-reminders` as active version 2 with existing managed secrets unchanged
- Normalized `tasks_powersync_role` to `LOGIN`, `REPLICATION`, `BYPASSRLS`, `NOCREATEDB`, `NOCREATEROLE`, and `NOINHERIT`
- Reapplied `SELECT` access to exactly the approved 22 synchronized Tasks tables
- Updated the existing `powersync` publication to exactly those 22 tables without dropping the publication or replication slot

## Deployment Defect and Correction

The first PowerSync normalization attempt completed the role step, then correctly stopped when the provisioning script used the fresh-install `CREATE PUBLICATION` path against the existing `powersync` publication. PostgreSQL rejected the duplicate publication before changing its table set.

The provisioner now queries one validated boolean from `pg_catalog.pg_publication` and selects `publication-update.sql` when `powersync` exists or `publication-create.sql` when it does not. The corrected run completed the role normalization, existing-publication update, and built-in verifier. A focused regression test keeps both paths present and requires the status response to remain a boolean.

## Production Evidence

- Migration history matches all six local versions with no pending Tasks migration
- The reminder Edge Runtime bundle passed with SHA-256 `111a44954682e49a94dba155694dd7d686268c40712b39a324b03829213cfad8`
- `dispatch-task-reminders` version 2 is active
- Hosted GET returns HTTP 405 and an unauthenticated POST returns HTTP 401
- Reminder delivery status is `ready` with one active `* * * * *` Cron job
- The latest three inspected Cron runs succeeded
- PowerSync database status is `ready` with exactly 22 synchronized tables
- The synthetic production topology gate passed cross-client convergence, owner isolation, persisted-client restart, and cleanup
- The PowerSync deployment configuration regression suite passes six focused tests

## Advisor Review

The post-deployment Supabase advisor pass reports zero Tasks `auth_rls_initplan` findings. This is the acceptance signal for the reminder RLS optimization.

The remaining Tasks warning-level security notices are the existing authenticated `SECURITY DEFINER` task-domain RPCs. They are intentional signed-in application APIs rather than newly exposed anonymous functions. Their ownership, explicit grant, idempotency, cross-owner isolation, and destructive-boundary behavior remain covered by the database and production topology gates.

Informational Tasks findings include private receipt tables with RLS and no client policy, foreign keys without dedicated covering indexes, and indexes that production has not yet used. None indicates an owner-isolation failure or a regression introduced by this deployment. Index changes require workload evidence and a separate migration rather than speculative production changes during closeout.

Project-wide database lint still reports two unrelated Drawers functions that reference the absent `drawers_insert_instances` relation. This Tasks change does not alter those functions.

## Managed pg_net Exception

The effective-role verifier accepts the previously documented Supabase-managed `pg_net` exception. The `net` schema and its operational relations are owned by `supabase_admin`, the project database owner cannot revoke the owner-issued `PUBLIC` access, and `tasks_powersync_role` has no direct grant on that schema or its relations. The schema remains outside the 22-table publication and owner-scoped Sync Streams.

## Decision

Task 7.11 is accepted. The production topology, reminder delivery path, optimized reminder RLS policies, and bounded PowerSync replication role are ready for the existing parallel-use phase. Things remains authoritative until a later replacement decision is explicitly approved.

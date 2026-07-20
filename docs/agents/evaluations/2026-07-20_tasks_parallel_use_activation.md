# Tasks Parallel-Use Production Activation Gate

**Date:** 2026-07-20
**Category:** Deployment / Privacy / Trust
**Status:** Locally ready, awaiting bounded production approval

## Decision Requested

Approve one bounded production-activation exercise for the neutral `/tasks` route. The exercise will provision remote synchronization and Web Push infrastructure, use synthetic accounts and device data first, remove the synthetic data, and stop before Inbox Manager dual writing or personal migration.

The approval includes these external changes:

1. Add PowerSync Cloud as a processor of personal task data and create one US-region development instance under the owner's account.
2. Create the least-privilege `tasks_powersync_role`, the Tasks-only `powersync` publication, the PowerSync replication slot, owner-scoped Sync Streams, Supabase Auth configuration, and a public client endpoint.
3. Enable the `pg_cron` and `pg_net` extensions in the BathOS Supabase project.
4. Create fresh VAPID and reminder-dispatch secrets in managed deployment storage, deploy the `dispatch-task-reminders` Edge Function, add the named Vault secret, create one fixed-name Cron job, and publish the matching public VAPID key to the web build.
5. Run the committed synthetic production-topology and device acceptance gates, then independently verify synthetic account and task cleanup.

This approval does not include a product-name selection, launcher publication, Inbox Manager dual writing, Things mutation, Things migration, native Apple development, or treating BathOS as authoritative.

## Current Production State

A read-only Supabase inspection on 2026 Jul 20 confirmed:

- The Bath organization is already on the Pro plan
- The BathOS project is active and healthy in `us-east-1` on Postgres 17
- No `tasks_powersync_role` exists
- No `powersync` publication or published table exists
- `pg_cron` and `pg_net` are not enabled
- No `tasks_reminder_dispatch_secret` Vault entry exists
- No `dispatch-task-reminders` Edge Function exists

The project is therefore cleanly unprovisioned. The activation can follow the fresh-install paths without reconciling a partial Tasks deployment.

Current Supabase pricing excludes external replication from Free. The existing Pro organization resolves the plan-level eligibility question, although the dashboard should still show any incremental billing before an external replication connection is accepted. PowerSync Cloud Free remains the recommended bounded-trial topology. It adds a new data processor and an external account even when its direct service cost is zero.

## Required Execution Order

### 1. Preserve and inspect

1. Take or verify a current production database backup.
2. Record the rollback owner and inspect existing publications, replication slots, Edge Functions, Vault secret names, and Cron jobs.
3. Re-run repository lint, build, tests, strict OpenSpec validation, PowerSync drift tests, reminder configuration tests, and the Edge Runtime bundle gate.

### 2. Provision synchronization privately

1. Create the PowerSync development instance without publishing its endpoint to the web build.
2. Generate the replication password outside the repository.
3. Apply `deploy/tasks-powersync/database-role.sql` and `publication-create.sql` through the direct database connection.
4. Run `deploy/tasks-powersync/verify.sql` and require `ready` with exactly 22 synchronized tables.
5. Configure Supabase Auth and deploy `deploy/tasks-powersync/sync-config.yaml` exactly as committed.
6. Run the synthetic production-topology acceptance gate against the unpublished endpoint.
7. Independently confirm that both synthetic users and their task rows are absent.
8. Publish `VITE_TASKS_POWERSYNC_ENDPOINT` only after the server-side gate passes, then repeat browser-level synthetic validation.

### 3. Provision reminder delivery

1. Generate a fresh VAPID P-256 key pair and a separate dispatch secret outside the repository.
2. Run `npm run verify:tasks:edge-bundle` and `npm run verify:tasks:reminders` with the intended values.
3. Run `deploy/tasks-reminders/extensions-enable.sql` and verify `pg_cron` and `pg_net`.
4. Set the four server-only Edge Function secrets and deploy `dispatch-task-reminders` with its approved custom dispatch-secret boundary.
5. Set only the matching public key as `VITE_TASKS_WEB_PUSH_PUBLIC_KEY` in the web environment.
6. Add exactly one `tasks_reminder_dispatch_secret` Vault entry.
7. Run `cron-create.sql` and `verify.sql` immediately.
8. Prove the hosted method and authentication boundaries, then complete the synthetic-device subscription, delivery, opening, acknowledgement, revocation, and cleanup test.

### 4. Begin bounded personal parallel use

1. Keep the neutral Tasks route experimental and keep Things authoritative.
2. Observe PowerSync health, retained WAL, queue depth, conflicts, Web Push outcomes, and cleanup evidence.
3. Ask separately before enabling Inbox Manager dual writing.
4. Record lived reliability evidence before any launcher, native-client, migration, or replacement decision.

## Stop Conditions

Stop activation and roll back the unpublished path if any of these conditions occurs:

- The dashboard reports an unapproved new charge
- The PowerSync processor or region differs from the approved boundary
- The publication, stream, role, or client schema differs from the exact 22-table contract
- Another BathOS module or a server-only Tasks table enters replication
- Synthetic owner isolation, restart, conflict, or cleanup proof fails
- The VAPID public keys differ or the private key enters a client environment
- The Cron job embeds a decrypted secret, has the wrong endpoint, or is duplicated
- Hosted Web Push cannot record provider outcomes or clean up its synthetic target

## Rollback Boundary

Synchronization rollback removes the unpublished client endpoint first, then stops or detaches PowerSync before changing its replication slot, publication, or role. Local task databases remain intact.

Reminder rollback removes the fixed-name Cron job first. The Edge Function and its secrets can then be removed or rotated after the job is confirmed absent. `pg_cron` and `pg_net` are not removed automatically because another workflow may share them later. Task work remains available with reminder delivery degraded or absent.

No rollback action writes to Things or enables Inbox Manager.

## Local Evidence

- Repository lint passed
- Production build passed with Tasks retained as a lazy module chunk
- Full application suite passed with 527 tests and 9 intentional opt-in skips across 97 files
- Strict OpenSpec validation passed all 6 current changes and durable specs
- PowerSync and reminder deployment tests passed 24 focused assertions before the extension correction
- The corrected extension/Reminder deployment test passed all 9 assertions
- Reminder and Web Push pgTAP suites passed 83 assertions
- Edge Runtime `v1.74.2` bundled the dispatcher and removed its temporary artifact
- The exact extension, Vault, Cron, and verification sequence reported `ready` inside a transaction and rolled back
- Production effects from this preparation: None

## Supporting Packages

- `deploy/tasks-powersync/`
- `deploy/tasks-reminders/`
- `docs/agents/evaluations/2026-07-20_tasks_production_sync_topology.md`
- `docs/agents/evaluations/2026-07-20_tasks_production_sync_readiness.md`
- `docs/agents/evaluations/2026-07-20_tasks_reminder_delivery_readiness.md`

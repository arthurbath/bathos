# Tasks Reminder Sync Optimization

**Date:** 2026-08-07  
**Status:** Released and verified

## Decision

Keep reminder claims as a server-side idempotency mechanism, but stop retaining empty polls and stop synchronizing the operational receipt table to clients. Retain nonempty receipts for 24 hours, throttle delivery-target heartbeats, and purge expired receipts through a private service-role function scheduled hourly when `pg_cron` is available.

This preserves reminder delivery and retry behavior while removing the unbounded receipt growth and client synchronization traffic produced by minute-by-minute empty checks.

## Production preflight

The approved preflight matched the implementation baseline:

- The PowerSync publication contained 17 Tasks tables, including `tasks_reminder_claims`.
- The PowerSync replication role could select the receipt table.
- Production contained 18,966 receipts, including 18,810 empty results.
- The receipt table and indexes occupied 5,439,488 bytes.
- No retention cron job existed.
- Reminder delivery history contained 17 acknowledged and 4 provider-accepted deliveries.

No protected reminder delivery, recurrence, or task data was changed by the rollout.

## Production changes

- Deployed the 16-table owner-scoped PowerSync topology and removed `tasks_reminder_claims` from the synchronized surface.
- Applied migration `20260807195812_reduce_task_reminder_sync_churn.sql`.
- Revoked receipt-table access from the PowerSync replication role.
- Made empty legacy and v2 reminder claims write-free.
- Added conditional nonempty idempotency receipts with 24-hour retention.
- Added the private `tasks_private.purge_expired_reminder_claims()` function and hourly `tasks-purge-reminder-claims` cron job.
- Performed the migration's one-time purge of expired receipts.

## Acceptance evidence

Post-release readback confirmed:

- The PowerSync publication contains exactly 16 approved Tasks tables and excludes `tasks_reminder_claims`.
- The PowerSync replication role cannot select the receipt table.
- The hosted PowerSync deployment is active, has no health warnings, and reports current replication.
- A connected client remained healthy after the topology change.
- The purge cron job is active on schedule `17 * * * *`.
- The purge function is executable by `service_role` and not by `authenticated`.
- 301 recent receipts remained after migration cleanup. Historical reminder delivery counts were unchanged.
- Across an observed minute with a connected client, an empty reminder poll created no receipt and did not update a delivery target's `last_seen_at` value.
- The production database boundary verifier completed successfully.

Post-DDL security advisors reported no issue introduced by this change. The performance advisor continued to note that `tasks_reminder_claims.owner_id` has no covering index. At the bounded post-cleanup size of approximately 301 rows, an additional index would add write overhead without a material cascade-delete benefit, so no index was added.

## Validation

- Focused Tasks reminder and PowerSync tests passed.
- Focused Supabase reminder pgTAP tests passed.
- Production build passed.
- Lint passed with one pre-existing Fast Refresh warning.
- OpenSpec validation passed.
- Supabase database lint completed without a new migration-specific finding.

The full Vitest run still has two unrelated calendar-keyboard failures, and the full local Supabase suite still stalls in an existing daily-rollover fixture. Neither failure exercises reminder claims, the publication boundary, or receipt retention.

## Rollback

If rollback is required, restore `tasks_reminder_claims` to the PowerSync publication, replication-role grant, hosted owner stream, and client schema before reverting the database functions. Keep the 24-hour receipt model in place unless exact historical empty-poll receipts become an explicit requirement.

# Tasks Reminder Claim Optimization

This package is the production gate for removing empty in-app reminder checks from durable storage and keeping server-only claim receipts out of PowerSync. It contains no credentials or task content.

## Release order

1. Run `preflight.sql` against production and preserve its result with the release evidence.
2. Confirm the live publication still has the expected 17-table pre-release topology and that no earlier partial deployment exists.
3. Deploy `deploy/tasks-powersync/sync-config.yaml` to the hosted PowerSync instance. This removes the server-only claim table from the owner stream before the publication stops emitting it.
4. Apply `supabase/migrations/20260807203338_reduce_task_reminder_sync_churn.sql` through the supported Supabase migration workflow.
5. Run `verify.sql` and `deploy/tasks-powersync/verify.sql` independently.
6. Publish the client only after both database readbacks succeed.
7. Confirm an open fallback surface still receives a due reminder and that repeated empty checks create neither a receipt nor a target timestamp update.

Production execution requires a fresh preflight and explicit approval. Abort if the publication, role, functions, cron extension state, or receipt counts drift from the reviewed evidence.

## Rollback boundary

If the hosted stream deployment fails before the database migration, redeploy the prior 17-table stream and stop. No database state has changed.

If reminder claiming fails after the migration, restore the prior definitions of `tasks_claim_due_reminders` and `tasks_claim_due_reminders_v2` from migrations `20260806005851_preserve_in_app_fallback_after_web_push_acceptance.sql` and `20260806013419_scope_in_app_reminders_to_surface.sql`. The receipt table may remain server-only during this functional rollback because no client reads or uploads it. Do not restore it to PowerSync unless an independently reviewed client requirement is discovered.

The cleanup never changes tasks, reminder intent, occurrences, deliveries, or acknowledgements. Deleted receipts are operational idempotency records beyond their supported retry window and are not reconstructed during rollback.

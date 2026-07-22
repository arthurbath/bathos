# Tasks Done Retention Deployment

This package documents the production gate for `20260722000000_replace_tasks_inbox_logbook_trash_with_done.sql`. The migration replaces Inbox, the separate Today destination, Logbook, and Trash with Anytime-backed Today and Done. It also installs one once-per-minute owner-local retention job. Applying it to production is destructive and requires fresh explicit approval.

## Preconditions

1. Confirm the intended BathOS Supabase project.
2. Download and preserve a checksummed Tasks export before applying the migration.
3. Confirm `pg_cron` remains enabled and healthy.
4. Confirm the PowerSync publication and owner-scoped stream still contain exactly the approved 22 public Tasks tables.
5. Review that terminal content will become permanently unrecoverable at the owner-local midnight beginning its 31st day in Done.

## Deployment Sequence

1. Apply the approved migration.
2. Run `verify.sql`. It must report one active `tasks-purge-expired-done` job on `* * * * *`, a service-role-only purge function, the content-free private receipt table, and no public receipt-table grant.
3. Deploy the generated MCP Edge Function bundle from the same commit.
4. Publish the web build and update Raycast and Inbox Manager runtime sources only after the database and MCP service accept the current vocabulary.
5. Create one synthetic terminal record, prove it survives immediately before the owner-local boundary, invoke the boundary, and confirm its complete public content graph disappears while the content-free duplicate-suppression receipt remains.
6. Confirm a fresh disposable PowerSync client projects the delete without duplicate or resurrected records, then remove the disposable client state.

## Rollback Boundary

Run `cron-remove.sql` before any rollback migration or application rollback. Before the first purge, the legacy placement model can be restored with an explicit reverse migration and careful provenance-based mapping. After any purge, deleted content can be recovered only from a preserved backup. Disabling the Cron job does not reverse a completed purge.

This package contains no credential or secret.

# Tasks Structure Simplification Preflight

**Date:** 2026 Jul 22
**Category:** Production / Data Preservation / Release
**Status:** Production Backend Accepted / Web Publish Pending

## Scope

Migration `20260722204543_simplify_tasks_structure_and_scheduling.sql` makes Start Date a future-only deferral date, retains Day Horizon for active work, adds editable Primary Link, preserves same-day reminder delivery during automatic activation, permits Start Date after Deadline, adds Rechecking, removes headings, advances portable backups to schema 12, and preserves schema 3 through 11 restore compatibility. The matching release removes `tasks_headings` from the exact PowerSync boundary, yielding 21 synchronized tables, and updates the MCP and web clients together. A second once-per-minute job activates reached Start Dates independently from the existing reminder dispatcher and Done-retention jobs.

No preflight or acceptance transcript may include titles, notes, source URLs, source identifiers, template bodies, reminder destinations, or other task content.

## Content-Free Production Preflight

Run these aggregates through the existing private production provisioning path. Record counts only.

```sql
SELECT
  (SELECT count(*) FROM public.tasks_headings) AS heading_rows,
  (SELECT count(*) FROM public.tasks_todos WHERE heading_id IS NOT NULL) AS heading_bound_todos,
  (SELECT count(*) FROM public.tasks_todos WHERE start_date IS NULL AND today_section <> 'none') AS invalid_undated_todo_horizons,
  (SELECT count(*) FROM public.tasks_projects WHERE start_date IS NULL AND today_section <> 'none') AS invalid_undated_project_horizons,
  (SELECT count(*) FROM public.tasks_reminders WHERE status = 'active') AS active_reminders,
  (SELECT count(*) FROM public.tasks_reminders AS reminder
    WHERE reminder.status = 'active' AND NOT EXISTS (
      SELECT 1 FROM public.tasks_todos AS task
      WHERE reminder.root_type = 'todo' AND task.owner_id = reminder.owner_id
        AND task.id = reminder.task_id AND task.start_date IS NOT NULL
      UNION ALL
      SELECT 1 FROM public.tasks_projects AS project
      WHERE reminder.root_type = 'project' AND project.owner_id = reminder.owner_id
        AND project.id = reminder.project_id AND project.start_date IS NOT NULL
    )) AS active_reminders_without_start,
  (SELECT count(*) FROM public.tasks_todos WHERE start_date > deadline) AS todos_already_after_deadline,
  (SELECT count(*) FROM public.tasks_projects WHERE start_date > deadline) AS projects_already_after_deadline;
```

The following grouped values are closed enums rather than personal content and may be recorded:

```sql
SELECT 'todo_horizon' AS metric, COALESCE(today_section, '<null>') AS value, count(*)
FROM public.tasks_todos GROUP BY today_section
UNION ALL
SELECT 'project_horizon', COALESCE(today_section, '<null>'), count(*)
FROM public.tasks_projects GROUP BY today_section
UNION ALL
SELECT 'actionability', actionability, count(*)
FROM public.tasks_todos GROUP BY actionability
ORDER BY metric, value;
```

Before changing PowerSync, verify the existing healthy 22-table topology against the pre-migration contract. After the database migration and exact publication normalization, `node scripts/provision-tasks-production.mjs verify-sync-database` must report `ready` with 21 tables.

## Live Deployment Evidence

The 2026 Jul 22 final read-only production refresh returned these content-free results:

- 0 heading rows and 0 heading-bound to-dos
- 6 undated to-dos with a retained horizon and 0 affected projects
- 0 active reminders and 0 active reminders without a Start Date
- 0 existing to-dos or projects with Start Date later than Deadline
- 16 total to-dos: 15 Actionable and 1 Waiting
- Horizon distribution: 2 Inbox, 1 Now, 8 Next, 4 Later, and 1 legacy `none`

The migration will retain all 6 valid active horizons, normalize the legacy `none` sentinel to null, and backfill an actionable audited Mail or web source into Primary Link where available. It will not flatten or delete a heading record because production contains none.

The production migration ledger is synchronized through `20260722204543_simplify_tasks_structure_and_scheduling.sql`. The corrected migration applied transactionally after a production-shaped pre-migration fixture proved revision, history, reminder, Primary Link, heading-flattening, activation, and horizon preservation behavior.

The current PowerSync boundary contains exactly 21 published tables and 21 matching SELECT grants. `tasks_headings` has no publication membership or grant. All synchronized tables have RLS and full replica identity. The dedicated role retains the approved LOGIN, REPLICATION, and BYPASSRLS attributes without a non-SELECT table grant. PowerSync Sync Streams version 2 is Active with no issues. The once-per-minute activation, reminder-dispatch, and Done-retention jobs are active.

MCP function version 12 is active with the matching schema-12 Tasks contract. A disposable owner-scoped production fixture proved future-only Start Date, retained active horizons, reminder rebinding and cancellation, same-day automatic activation, Rechecking, Primary Link, schema-12 export, heading absence, and a fresh PowerSync projection. The fixture passed, and an independent cleanup query returned zero synthetic users, to-dos, and projects.

## Private Backup

1. Resolve the production direct database connection from the existing private secret store without printing it.
2. Create one timestamped, data-only PostgreSQL dump outside the repository in the existing private Tasks backup location.
3. Include the complete `public` and `tasks_private` schemas so every `public.tasks_*` table and all private recovery receipts are available. Do not place credentials or the backup filename in a public log.
4. Verify the dump footer and table COPY headers, then store its SHA-256 digest beside it and recheck the digest from a second read.
5. Run a schema-12 application export as an additional logical recovery artifact after migration. Keep both artifacts private.

The deployment may proceed only after the dump is structurally complete, its digest is stable across a second read, and the preflight counts have been recorded without content.

The private predeployment dump is complete. It contains every active Tasks table, `tasks_headings`, all required `tasks_private` recovery tables, and the PostgreSQL completion footer. The dump and its digest are owner-readable only. Independent SHA-256 verification passed.

## Rollback Boundary

Before production, rollback is ordinary source and migration replacement. After headings are flattened and dropped, a down migration cannot reconstruct heading titles or membership from current rows. A post-migration rollback therefore requires restoring the verified private database backup in a controlled replacement operation, restoring the 22-table PowerSync publication and stream, redeploying the prior MCP bundle and web build, and validating a fresh projection before clients resume mutation.

The release must stop before the migration if backup verification, content-free counts, migration parity, reminder-job compatibility, or publication ownership is uncertain. After the migration, the web release must not publish until the database, MCP function, reminder dispatcher, and 21-table PowerSync source all pass their bounded verification.

## Acceptance and Cleanup

Use one disposable synthetic owner to prove:

- a future-dated to-do and project default to Next while active work retains a horizon without a Start Date;
- Inbox, Now, Next, and Later persist and project without a `none` value;
- a reminder accepts time only, resolves on Start Date, rebinds when Start Date changes, cancels after a manual clear, and survives automatic activation for same-day delivery;
- today and earlier Start Date assignments are rejected while owner-scoped activation clears a reached date exactly once;
- Primary Link survives MCP creation, history, schema-12 export, restore, and a fresh PowerSync projection without changing audited source identity;
- Start Date later than Deadline remains accepted and visibly overdue;
- Rechecking survives MCP, history, schema-12 export, restore preview, and PowerSync projection;
- a legacy schema-11 fixture containing a heading restores its child to-do directly under the project;
- all 21 synchronized tables project and `tasks_headings` is absent;
- no synthetic user, task row, history row, reminder row, receipt, or local PowerSync database remains after cleanup.

Personal rows are verified only through aggregate counts and stable pre/post identifiers already held in private recovery evidence. No acceptance mutation targets personal content.

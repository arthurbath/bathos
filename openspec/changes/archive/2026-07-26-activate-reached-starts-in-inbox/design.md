## Context

Tasks stores future deferral in `start_date` and active Today placement in `today_section`. Both the local-first repository and the private once-per-minute server activation function currently clear a reached Start and assign `today_section = 'next'`. The same activation run first resets unfinished prior-day Today work to Inbox.

The user has replaced the earlier reached-Start policy: every task entering Today because its future Start has arrived must also enter Inbox for fresh daily re-planning.

## Goals / Non-Goals

**Goals:**

- Make local and server reached-Start activation converge on Today Inbox.
- Preserve rollover-before-activation ordering and reminder semantics.
- Cover ordinary, midnight, and missed-day catch-up activation.
- Deploy without rewriting existing task rows.

**Non-Goals:**

- Correct or relocate tasks that activated under the former policy.
- Change manual horizon selection, future Start validation, reminder resolution, project activation, recurrence, or PowerSync topology.
- Add another scheduled job.

## Decisions

1. **Change the two authoritative task activation paths in place.** The local repository and `tasks_private.activate_due_roots` will both assign Inbox while clearing a reached Start. This keeps offline and synchronized behavior equivalent.

2. **Replace the private server function through a forward-only migration.** PostgreSQL function definitions are migration-managed. The migration will change only executable policy and will contain no task-row `UPDATE` outside the function body, so applying it does not correct or rewrite existing data.

3. **Keep project activation unchanged.** The request concerns tasks and daily task re-planning. Projects retain their existing activation behavior unless separately specified.

4. **Retain rollover-before-activation ordering.** At midnight, prior-day Today tasks first reset to Inbox, then newly reached task Starts activate into the same Inbox horizon. This yields one daily triage surface without adding work or duplicate revisions.

5. **Test the new value at every boundary that previously asserted Next.** Repository unit tests and PostgreSQL rollover tests will assert Inbox for ordinary reached activation and owner-local midnight activation, including catch-up behavior where applicable.

## Risks / Trade-offs

- **[Risk] Existing users may expect deferred work to arrive pre-prioritized in Next.** → The user explicitly superseded that policy, and the durable specification will record the replacement.
- **[Risk] Local code could ship before the server policy or vice versa.** → Validate both paths together and deploy the function definition before the next midnight boundary.
- **[Risk] A migration might be mistaken for a corrective data rewrite.** → Keep the migration limited to `CREATE OR REPLACE FUNCTION`; verify that applying it changes zero task rows.

## Migration Plan

1. Update the local repository and tests.
2. Create a Supabase migration that replaces only `tasks_private.activate_due_roots`.
3. Run database, application, lint, build, and OpenSpec validation.
4. Refresh and verify the established private production backup before deployment.
5. Apply the forward-only function migration and verify zero task-row rewrites, cron continuity, function privacy, and the unchanged 21-table PowerSync publication.
6. Roll back, if required, by restoring the previous function definition. No task restoration is required because deployment itself rewrites no task data.

## Open Questions

None.

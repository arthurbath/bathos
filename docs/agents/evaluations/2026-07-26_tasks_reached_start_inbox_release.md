# Tasks Quick Filter and Reached Start Inbox Release

**Date:** 2026 Jul 26
**Category:** Product / Production / Trust
**Status:** Accepted

## Outcome

BathOS Tasks now places newly reached task Starts into Today Inbox instead of Today Next. This deliberately supersedes the earlier task-activation policy so newly available work must be reconsidered alongside unfinished work at the start of each owner-local day.

The same release adds one owner-wide Quick Filters preference with All Tasks, Only Ready, Only Not Ready, Only Rechecking, and Only Waiting. The local-first repository and the private server activation function use the same Start policy. Rollover still runs before reached-Start activation, project activation remains unchanged, and an already-resolved same-day reminder remains deliverable.

## Deployment Shape

Migration `20260725170929_add_tasks_quick_filter_preference.sql` adds the constrained preference and its timestamp to `bathos_user_settings`, initializes the three existing settings rows to All Tasks, and retains owner-only update policy. Migration `20260726141037_activate_reached_starts_in_inbox.sql` replaces only `tasks_private.activate_due_roots(timestamptz, uuid)` and reapplies its private execution boundary. It contains no immediate task-row mutation. Applying it therefore changes future execution policy without correcting or rewriting existing tasks.

The matching web release changes local activation so an offline or foreground client converges on Today Inbox before or alongside server synchronization.

## Validated Evidence

- The focused repository and runtime suite passes 28 assertions.
- The focused daily-rollover and simplified-scheduling pgTAP suites pass 80 assertions.
- The complete local database suite passes 665 assertions across 24 files.
- Tasks TypeScript checking, ESLint, the production Vite build, and strict validation of all 19 OpenSpec items pass.
- The complete application suite passes 1,019 assertions and skips 14 intentional integration or performance checks.
- A date-dependent calendar test uncovered during full validation now targets its fixed selected fixture date instead of the wall-clock current date.
- Local inspection confirms task activation uses Inbox, project activation still uses Next, and Public, anonymous, authenticated, and service-role callers cannot execute the private function.
- The production predeployment baseline contains one active once-per-minute `tasks-activate-due-roots` job, exactly 21 Tasks tables in the PowerSync publication, and the same private execution boundary.
- The migration does not alter Cron, PowerSync, table definitions, publications, grants on tables, reminders, or task rows.
- The private backup `2026-07-26T072433-0700-pre-reached-start-inbox.sql` is 3,940,229 bytes, contains 54 data sections and a PostgreSQL completion marker, is owner-only, and has stable SHA-256 `0dc02fd1c95523c0ab54ba1a6da5a8aff4c872359df9947559dbad8806f0509e`.
- Both approved migrations are recorded locally and remotely in order. Production retained 27 tasks, 612 history events, four reminders, one project, one active minute activation job, and exactly 21 published Tasks tables.
- Commit `31f5b73` is pushed to `main` and published through Lovable deployment `317b9a30-12b6-4027-a079-ea5ec29233bd`. The live Tasks chunk contains the complete Quick Filters labels and Today Inbox activation wording.
- The owner-scoped fixture proved the default All Tasks preference, an owner-authorized Waiting update, reached-Start activation into Inbox, current-client projection, fresh PowerSync projection, and zero residual synthetic users, settings, tasks, or history.
- The live desktop control produced distinct memberships for all four filters and was restored to All Tasks after acceptance. The complete Tasks suite retains responsive behavior coverage.
- PowerSync reports `ready` with exactly 21 synchronized tables. Three consecutive activation job runs succeeded, the fixture left no orphaned rows, and current Supabase advisors report no Tasks performance warnings or private activation exposure.

## Production Procedure

The owner approved and the release completed through this procedure.

1. Refresh the private production backup immediately before mutation.
2. Verify owner-only file permissions, the PostgreSQL completion marker, a stable SHA-256 across two reads, and content-free task counts.
3. Apply migrations `20260725170929_add_tasks_quick_filter_preference.sql` and `20260726141037_activate_reached_starts_in_inbox.sql` in order.
4. Confirm the migration changed zero task rows and appended no task history event.
5. Publish the matching BathOS web commit through Lovable.
6. Run one owner-scoped disposable fixture proving rollover-before-activation, task activation into Inbox, project activation remaining Next, reminder preservation, and repeat-call idempotence.
7. Remove the fixture and independently confirm zero synthetic residue.
8. Verify the private function grants, one active minute job, exactly 21 PowerSync Tasks tables, a fresh PowerSync projection, production build parity, and Supabase advisors.

## Rollback

Before the first production activation, rollback is an ordinary function replacement and web republish. After an activation has occurred, restoring the earlier function changes only future behavior and does not reconstruct task horizons already assigned by the new policy. The verified private backup remains the recovery boundary for any unexpected data mutation, although the prepared migration itself performs no data rewrite.

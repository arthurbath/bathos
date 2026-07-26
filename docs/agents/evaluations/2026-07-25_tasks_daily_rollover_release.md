# Tasks Daily Rollover Release

**Date:** 2026 Jul 25
**Category:** Product / Production / Trust
**Status:** Accepted

## Outcome

BathOS Tasks now resets unfinished prior-day Today work to the Inbox horizon at the first once-per-minute activation run after each owner's local midnight. The existing `tasks-activate-due-roots` job remains the single scheduler: it performs the rollover before activating future Starts that have reached the owner's new planning date.

The release is accepted in production. Migration `20260726013335_roll_over_unfinished_today_tasks.sql` is recorded once, the private owner cursor is initialized for the one current owner, the exact 21-table PowerSync boundary is unchanged, the disposable production fixture passed and was removed, and Lovable deployment `56e3289f-8257-4e25-9207-ba5c53ecadb0` serves scoped commit `f8836e08ca3bdd0293e4f32a986e00e11ea49446`.

## Private Backup

The verified predeployment backup is:

`/Users/Art/Library/Application Support/garden.bath.bathos/tasks-production-backups/2026-07-25T184925-0700-pre-daily-rollover.sql`

It is owner-only mode `0600`, contains 42 data insert statements and the PostgreSQL completion marker, and measured 3,612,578 bytes. Two independent reads produced the same SHA-256:

`58a385d97fc82e1af74f25b32c9da83b8dc916694141af9ce49a2b96f970eb83`

## Database Acceptance

- The migration itself changed no task row.
- One private owner rollover cursor was initialized to the current owner-local planning date.
- Anonymous and authenticated roles cannot select the cursor or execute the private activation function.
- The cursor table is absent from PowerSync.
- The `powersync` publication still contains exactly 21 public Tasks tables.
- Cron job `tasks-activate-due-roots` remains active once per minute with its original command, and its latest audited run succeeded.
- The post-DDL Supabase security and performance advisor sets contain no finding that references the rollover cursor, trigger, reminder rebind, or activation function.

At the acceptance boundary, eight open non-Inbox Today tasks remained unchanged. If they remain open and unchanged, the first activation run after the current owner's next local midnight will reset their horizon to Inbox.

## Disposable Production Fixture

The owner-scoped fixture used only synthetic owner `f6000000-0000-4000-8000-000000000001`. It proved in one bounded acceptance path that:

- one unfinished prior-day Later task reset to Today Inbox;
- one reached future Start activated into Today Next;
- the rollover was attributed to the system and advanced the task revision;
- the owner cursor advanced to the simulated new planning date;
- the private rollover did not rebind or recreate reminders.

The fixture returned one rolled-over task, one rolled-over owner, one activated task, and zero activated projects. Cleanup then removed the synthetic user, settings, tasks, history, and private cursor. An independent production query confirmed zero residue in every collection.

## Application Release

Commit `f8836e0` was pushed to `main` and published through Lovable. Lovable reports the exact full commit SHA, a ready project, and no deployment error. The custom-domain route `https://os.bath.garden/tasks/today` returns HTTP 200 with deployment header `56e3289f-8257-4e25-9207-ba5c53ecadb0`.

The exact deployed commit passed:

- 966 application tests, with 14 intentional skips;
- 30 dedicated database rollover checks;
- ESLint;
- the production Vite build;
- strict OpenSpec validation.

The OpenSpec change is synchronized into the durable Tasks specification and archived as `2026-07-25-roll-over-unfinished-today-tasks`.

## Rollback

The verified private backup is the authoritative recovery artifact if production data restoration is required. Application rollback may republish the preceding web commit. Database rollback should be treated as a controlled replacement operation because removing the cursor and prior function body after a rollover has occurred does not reconstruct the horizons that were intentionally reset.

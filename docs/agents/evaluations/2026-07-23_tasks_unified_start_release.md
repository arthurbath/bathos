# Tasks Unified Start Release

**Date:** 2026 Jul 23
**Category:** Production / Interaction / Data Preservation
**Status:** Accepted

## Scope

Migration `20260723175454_unify_task_start_planning.sql` and BathOS web checkpoint `41d7fa6` replace the separate task Start Date, Day Horizon, and Reminder Time controls with one Tasks-owned Start picker. The release also preserves explicitly cleared Primary Links, lets Today horizons carry reminders, and narrows the active to-do menu to Move, Do, Start, and Delete without Cancel, Move Up, or Move Down.

## Data Safety

Immediately before mutation, the existing owner-only private Tasks backup location received a fresh data-only PostgreSQL dump of `public` and `tasks_private`. The dump contains a completion footer, 24 public Tasks COPY sections, and all 7 private recovery COPY sections. Its dump and digest are owner-readable only, and two independent digest reads matched.

After migration, the same private location received a server-validated schema-12 logical Tasks export. The artifact identifies `garden.bath.tasks.export`, schema version 12, and all 20 portable collections. Its owner-only permissions and second-read digest passed. Neither private artifact is stored in the repository.

## Database Acceptance

The remote migration ledger records `20260723175454_unify_task_start_planning`. Content-free verification proves:

- `normalize_todo_primary_link` applies Mail-source fallback only during INSERT.
- The effective reminder-date helper exists and remains unavailable to public, anonymous, and authenticated direct execution.
- The new reminder RPC is executable by authenticated users and unavailable to anonymous users.
- To-do and project reminder-rebind triggers are active.
- Existing production counts remain 16 to-dos, 12 editable Primary Links, 9 Mail-derived Primary Links, 3 active Today roots, and 0 active reminders.
- The PowerSync publication remains exactly 21 Tasks tables.

The activation, reminder-dispatch, and Done-retention jobs remain active once per minute, and each latest run succeeded. Performance advisors reported only the existing project findings. Security advisors added the expected generic warning for the intentional authenticated `tasks_save_start_reminder` SECURITY DEFINER RPC; direct private helper execution remains revoked and the RPC performs its authenticated owner check before mutation.

## Web Acceptance

Lovable published checkpoint `41d7fa6` through deployment `49769722-a399-4b84-b09a-0054c9c65413`. Production serves entry bundle `index-w71s94r4.js` and Tasks chunk `TasksIndex-CZUEAAu8.js`. The live chunk contains the unified Start picker, Reminder Time, No Start, Do, and Start release markers.

Authenticated Chrome production validation proved:

- the page identity and nonblank Tasks runtime;
- a clean console with no app warnings or errors;
- the exact active task menu with Move, Do, Start, and Delete, and without Cancel, Move Up, or Move Down;
- Inbox, Now, Next, and Later horizon controls;
- disabled calendar dates through the owner planning date and enabled future dates;
- reminder time and Clear inside the same Start surface;
- Command+E opening the Start picker with the reminder time input focused.

No personal task was mutated during browser validation.

## Synthetic Acceptance And Cleanup

The first disposable fixture run stopped before its first planning mutation because the test harness used the move contract without its required destination. Its after-all cleanup deleted the synthetic user and every dependent row. The gate was corrected to use the schedule contract for a date-only change and the move contract for horizon changes, then recompiled and rerun once.

The accepted rerun proved:

- a Mail-derived Primary Link initializes on capture;
- explicit null persists through MCP mutation, schema-12 export, and a fresh PowerSync database;
- immutable Mail provenance remains unchanged;
- a Today reminder resolves on the owner planning date;
- future scheduling and return to Today rebind the reminder exactly;
- clearing complete Start intent cancels the reminder and scheduled occurrence;
- deletion of the disposable owner removes task, source, history, reminder, and local projection data.

An independent post-run query returned zero synthetic users, to-dos, Mail sources, history rows, and reminders. A final PowerSync verifier reported `ready` with exactly 21 synchronized tables.

## Decision

The unified Start and Primary Link release is accepted in production. The durable specification is synchronized, the OpenSpec change is archived, the full validation suite passes, and repository and production parity are proven at closeout.

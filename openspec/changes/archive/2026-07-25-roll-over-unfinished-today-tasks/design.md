## Context

Today membership is represented by a non-null `today_section`; active Today tasks do not also store a `start_date`. The existing `tasks_private.activate_due_roots` function runs once per minute and converts reached future Starts to Today Next, while the web runtime performs the same activation locally for immediate and offline behavior. Neither path currently records whether an owner's planning date has advanced, so prior-day horizons persist.

## Goals / Non-Goals

**Goals:**

- Reset unfinished prior-day Today tasks to Today Inbox at the owner's local day boundary.
- Run the rollover before reached future Starts activate so newly scheduled work still enters Today Next.
- Make server and local execution idempotent and safe across missed polls, restarts, and multiple days.
- Preserve task history, reminder identity, and the existing 21-table PowerSync publication.

**Non-Goals:**

- Rolling over project horizons.
- Creating a visible Start Date for Today tasks; the UI continues to derive Today from the horizon.
- Moving or repeating reminders when their task rolls over.
- Adding a user-configurable rollover policy or rollover time.

## Decisions

### Track the last processed planning date outside synchronized user data

The server will store one per-owner cursor in `tasks_private`, keyed by owner ID and initialized to the owner's current planning date during migration. This state is operational rather than portable user content, requires no Data API access or RLS policy, and does not add a PowerSync publication table.

The client will store its corresponding planning-date cursor in the existing local-only owner-binding row. An installation without a cursor initializes it to the current planning date without rewriting tasks; after that baseline, the local runtime can detect every date boundary without a server round trip.

Adding a public `today_date` column to every task was rejected because Today already has an owner-level date boundary, the extra field would widen synchronization and portability contracts, and it would create an additional consistency invariant on every task mutation.

### Rollover and activation share one ordered operation

The existing once-per-minute activation function will, for each eligible owner:

1. Lock the owner's private day cursor.
2. If the owner-local planning date advanced, update open, present Today tasks last changed before the new owner-local midnight to Inbox and advance the cursor.
3. Activate reached future task and project Starts into Today Next.

The local runtime will mirror that ordering and cutoff. Excluding tasks changed after midnight prevents a newly created or deliberately re-planned task in the first polling minute from being mistaken for prior-day work. A cursor equal to or later than the current planning date is a no-op, so repeated minute polls and concurrent invocations cannot repeatedly revise the same tasks.

### Keep rollover task-scoped

Only `tasks_todos` rows roll over. Project planning remains unchanged because the requested re-reckoning applies to tasks, while the existing function continues activating reached project Starts as before.

### Preserve reminder dates during rollover

Changing a horizon normally rebinds an active reminder to the current planning date. Rollover will use a transaction-local system context that causes the reminder rebind trigger to leave the existing reminder and occurrences unchanged. A reminder scheduled for the day that ended must not silently become a reminder on the new day.

### Preserve revision and history semantics

Each changed task advances by exactly one revision with a new mutation ID, system actor metadata, and an ordinary accepted history event. Completed, canceled, deleted, Someday, future-starting, and horizon-free Anytime tasks are excluded.

## Risks / Trade-offs

- **[Client and server race on the same task]** → Both paths converge to Inbox, existing revision conflict handling retains one authoritative revision, and the owner cursor prevents repeated retries after the date is marked processed.
- **[Planning time zone changes across the date line]** → Rollover only advances when the derived planning date is later than the cursor; it never rolls state backward.
- **[Cron is delayed or unavailable]** → The next minute poll, server invocation, or open-client local poll performs the missed idempotent rollover.
- **[An upgraded offline client has no prior local cursor]** → Establish the current date as a safe baseline without rewriting ambiguous tasks; the authoritative server handles the deployment-day boundary once connected, and later offline boundaries are fully tracked.

## Migration Plan

1. Create the private owner rollover-state table and initialize every existing owner to their current planning date without rewriting current tasks.
2. Replace the existing activation function and reminder rebind trigger with the rollover-aware versions; preserve the existing Cron job name and schedule.
3. Extend the local-only PowerSync owner-binding schema and runtime activation path.
4. Validate boundary ordering, exclusions, reminder preservation, idempotency, owner time zones, local execution, and the unchanged Cron schedule.
5. Apply the production migration only after refreshing the private Tasks backup and receiving explicit approval.

Rollback restores the prior activation and reminder-trigger definitions and removes the private cursor table. Tasks already reset to Inbox remain valid user data and are not automatically moved back.

## Open Questions

None.

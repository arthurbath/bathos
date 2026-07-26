## Why

Unfinished Today tasks currently retain their prior horizon indefinitely across owner-local day boundaries, allowing stale Now, Next, or Later decisions to carry forward without deliberate reconsideration. Tasks should reset that unfinished work to Today Inbox after midnight so the user must plan it again.

## What Changes

- Detect owner-local planning-date advancement through the existing once-per-minute server activation path and the open-client local activation path.
- Before activating newly reached future Starts, move every open, present task already in a Today horizon to Today Inbox.
- Keep completed, canceled, deleted, Someday, and future-starting tasks unchanged.
- Preserve existing reminder dates and occurrences rather than silently moving an elapsed reminder to the new day.
- Record each accepted task rollover as a system-authored revision and history event while making repeated checks idempotent.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Today planning gains owner-local midnight rollover semantics for unfinished tasks.

## Impact

- Supabase: a private per-owner rollover cursor, the existing `tasks_private.activate_due_roots` function, and its existing once-per-minute Cron job.
- Tasks web runtime: local planning-day state, offline task rollover, activation ordering, and repository tests.
- Synchronization: existing `tasks_todos` revisions and history events only; no new synchronized or published table.
- No public RPC, MCP, Edge Function, PowerSync publication-table, or reminder-delivery API changes.

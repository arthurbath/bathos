## Why

Tasks that share an Upcoming date can be deliberately arranged as one mixed sequence of ordinary to-dos and recurrence prototypes, but midnight activation currently sends recurrence instances and ordinary tasks through separate ordering paths. The resulting Today Inbox order does not preserve the sequence the user established in Upcoming.

## What Changes

- Treat every task newly realized into Today Inbox during one owner-local activation pass as a single ordered batch.
- Preserve the mixed Upcoming order of ordinary tasks and generated recurrence instances that share the reached planning date.
- Continue placing the newly realized batch after Inbox work that was already present or rolled over before activation.
- Add database regression coverage for mixed ordinary and recurrence ordering, retry idempotency, and existing-Inbox placement.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Clarify that owner-local activation preserves the mixed Upcoming order of ordinary tasks and recurrence prototypes when their work enters Today Inbox.

## Impact

- Tasks Supabase activation and recurrence-materialization functions.
- Tasks database migration history and pgTAP coverage.
- No new tables, dependencies, routes, or client-side UI surfaces.

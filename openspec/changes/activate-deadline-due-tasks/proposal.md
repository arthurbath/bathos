## Why

Deadline-only to-dos currently appear in Upcoming until their deadline, then fall out of Upcoming without entering Today. A deadline should act as an implicit Start only when no explicit Start exists, so due work reliably surfaces in Today at the owner's local midnight.

## What Changes

- Activate an open, present, Anytime to-do into Today Inbox when its deadline reaches the owner-local planning date and it has no explicit Start or Today horizon.
- Keep the deadline-only to-do visibly unplanned before activation: its Start remains unset while Upcoming derives its controlling date from the deadline.
- Preserve explicit Start precedence, including when a future Start falls after an earlier deadline.
- Apply the same idempotent activation semantics in the offline repository and server-side daily planning path, including missed-day catch-up.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Extend date-based planning and temporal activation so a reached deadline materializes deadline-only work in Today Inbox without inventing a visible future Start beforehand.

## Impact

- Tasks planning projection and local repository activation logic.
- `tasks_private.activate_due_roots` through a forward-only Supabase migration.
- Tasks repository, Upcoming projection, and database rollover tests.
- No new table, PowerSync table, dependency, or public API surface.

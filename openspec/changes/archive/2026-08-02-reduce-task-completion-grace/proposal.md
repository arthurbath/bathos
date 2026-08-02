## Why

The three-second reversible checked state after completing a closed task feels longer than necessary. A two-second grace period preserves accidental-click recovery while making successful completion feel more responsive.

## What Changes

- Reduce the closed-task completion grace period from three seconds to two seconds.
- Preserve cancellation, terminal animation, persistence, undo reservation, and focus behavior.
- Update timing regression coverage.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Shorten the established closed-task accidental-click grace period to two seconds.

## Impact

- Tasks completion timing in `TasksShell`.
- Tasks completion lifecycle tests and the durable personal Tasks specification.
- No database, Supabase, native companion, dependency, or API change.

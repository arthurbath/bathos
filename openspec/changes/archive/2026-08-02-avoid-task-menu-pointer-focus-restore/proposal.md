## Why

Pointer-dismissed task action menus currently return keyboard focus to their ellipsis triggers, even though clicking elsewhere indicates that the user has redirected their attention. The menu should close without creating a new visible or programmatic focus target on the task row.

## What Changes

- Distinguish pointer-outside dismissal from ordinary task-menu action handling.
- Prevent the ordinary-task and recurrence-prototype ellipsis triggers from retaining or regaining focus after a pointer-outside dismissal.
- Preserve the established menu action behavior and whole-task focus clearing.
- Add regression coverage for pointer-outside dismissal.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Make the existing no-trigger-focus-restoration contract explicit for pointer-outside dismissal of ordinary-task and recurrence-prototype ellipsis menus.

## Impact

- Task action-menu focus handling in `TasksShell` and recurrence prototype rows.
- Focused Tasks component regression coverage.
- No database, Supabase, native companion, dependency, or API change.

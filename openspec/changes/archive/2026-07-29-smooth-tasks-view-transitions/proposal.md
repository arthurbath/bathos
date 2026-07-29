## Why

Switching between Tasks planning views currently exposes a transient list projection while the watched PowerSync query re-evaluates for the destination route. The resulting two-step row replacement reads as a visual "ker-chunk" even though navigation itself is fast.

## What Changes

- Treat list-to-list route changes as a brief destination-settling interval.
- Show the existing Tasks loading treatment instead of stale or partially projected rows while the destination query re-evaluates.
- Reveal the destination list once, after its query has settled and a short minimum loading presentation has elapsed.
- Keep same-view synchronization and ordinary task mutations live without replacing the list with a route-transition spinner.
- Apply the behavior consistently to pointer, navigation-link, and keyboard-driven route changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Add a settled-presentation contract for route changes among Tasks planning lists.

## Impact

- Tasks list query status from `src/modules/tasks/hooks/useTaskList.ts`.
- Route and list presentation state in `src/modules/tasks/components/TasksShell.tsx`.
- Focused hook, shell, and rendered navigation tests.
- No database, Supabase, PowerSync schema, native companion, or external API changes.

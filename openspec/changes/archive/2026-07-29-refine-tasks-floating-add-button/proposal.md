## Why

The floating New Task action is visually heavier than the newly refined mobile navigation. Applying the same translucent, blurred surface language will unify the persistent bottom controls while retaining green as the semantic creation color.

## What Changes

- Restyle the floating New Task action as a translucent solid-green glass button with backdrop blur.
- Use a subtle lighter-green border and a white Lucide Plus.
- Reduce the visible button diameter while preserving an appropriate touch target and its existing placement and behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine the required visual treatment of the primary floating creation action.

## Impact

- Tasks list presentation in `src/modules/tasks/components/TasksShell.tsx`.
- Tasks list component coverage and rendered responsive QA.
- No database, API, dependency, routing, or native companion changes.

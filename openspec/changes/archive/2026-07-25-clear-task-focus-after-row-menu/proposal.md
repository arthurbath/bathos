## Why

Closing or acting through a task's ellipsis menu currently promotes that task into whole-task keyboard focus. Point-and-click menu interaction should end without leaving an unrelated keyboard-navigation state on the task row.

## What Changes

- Clear whole-task focus whenever the active task ellipsis menu closes, whether it is dismissed or an action is selected.
- Keep focus cleared after completing or dismissing Move, Do, or Start surfaces opened from the ellipsis menu.
- Stop moving focus to the current or fallback task after a terminal action initiated from the ellipsis menu.
- Preserve existing whole-task focus restoration for non-menu keyboard commands and direct task controls.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine task action-menu focus ownership so ellipsis-menu interaction relinquishes whole-task focus instead of restoring it.

## Impact

- Tasks module only.
- Task row action-menu close behavior, menu-launched planning dialogs, terminal-action focus fallback, and focused interaction tests.
- No database, Supabase, PowerSync, MCP, API, dependency, or cross-module changes.

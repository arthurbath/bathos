## Why

Bulk reminder editing creates conditional behavior across selected tasks with different Start states and reminder-time eligibility. Reminders are inherently task-specific, so selection mode should not expose or invoke a bulk reminder workflow.

## What Changes

- Remove the multi-task reminder popover and its bulk mutation path from the Tasks interface.
- Make Control+B on Mac and Alt+Shift+B on Windows inert while selection mode is active, whether zero, one, or many tasks are selected.
- Preserve the existing reminder shortcut and Start-picker behavior for one open task outside selection mode.
- Remove bulk-reminder-only parsing, validation, focus, and presentation tests while adding explicit regression coverage for the inert selection-mode shortcut.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Restrict reminder editing to an individual open task and remove reminder editing from task selection mode.

## Impact

- Tasks keyboard-command routing and selection-mode state in `src/modules/tasks/components/TasksShell.tsx`.
- Bulk reminder UI and tests that are no longer reachable or needed.
- No database, reminder-storage, native companion, or synchronization schema changes.

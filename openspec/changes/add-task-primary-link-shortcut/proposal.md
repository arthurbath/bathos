## Why

Opening a focused task's Primary Link currently requires pointer navigation even though Tasks already provides keyboard commands for the rest of the focused or open task workflow. A dedicated command should activate the same destination as the existing Primary Link control without changing how links are normalized or routed.

## What Changes

- Add Control+J on Mac as the task-specific command for opening the Primary Link of the singular open or keyboard-focused to-do.
- Add the equivalent Alt+Shift+J binding on Windows, following the established cross-platform task-command mapping.
- Reuse the existing Primary Link normalization and activation behavior, and do nothing when there is no singular target or no actionable Primary Link.
- Document the command in the Keyboard Shortcuts modal and cover command mapping and activation with automated tests.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Extend task-specific keyboard commands so a singular open or keyboard-focused task can activate its Primary Link.

## Impact

The change is limited to the Tasks module keyboard-command registry, task command dispatch, Keyboard Shortcuts reference, focused tests, and the existing personal Tasks specification. It changes no database objects, APIs, dependencies, native application code, or Primary Link routing rules.

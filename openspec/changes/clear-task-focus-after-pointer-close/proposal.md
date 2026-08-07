## Why

Closing an expanded to-do with a pointer currently leaves whole-task keyboard focus on the freshly closed summary row, even though the user has switched to a point-and-click interaction. Pointer closure should leave focus absent, while keyboard closure must retain the focused row so keyboard navigation can continue predictably.

## What Changes

- Distinguish pointer-triggered task-editor closure from keyboard-triggered closure.
- Clear lightweight task focus and DOM focus after clicking or tapping an open task's summary row to close it.
- Preserve focus on the freshly closed task summary row when the documented keyboard close command closes the editor.
- Add regression coverage for both interaction paths, including recurrence prototypes where they share the ordinary task close behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine the task-editor close focus contract according to whether closure was invoked by pointer or keyboard.

## Impact

- **Module:** Tasks only.
- **Code:** Task summary-row activation, task-editor close orchestration, focus restoration, and related component tests.
- **Shared components:** No shared UI behavior changes are expected.
- **Data and APIs:** No database, Supabase, PowerSync schema, or external API changes.

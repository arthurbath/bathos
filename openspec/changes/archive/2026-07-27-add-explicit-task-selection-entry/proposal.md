## Why

Task multi-selection currently depends on discoverable keyboard or modified-click gestures, leaving point-and-click users without an obvious way to enter selection mode. A visible list action should expose the same workflow while safely supporting an intentionally empty initial selection.

## What Changes

- Add a Select Tasks icon button to the top-right action row of every task list that supports task selection.
- Keep the button off Config and other non-selectable Tasks surfaces.
- Let that button open selection mode with zero tasks selected and close any open task editor first.
- Render the existing fixed selection toolbar with a zero-task count while keeping selection-dependent actions, including Plan Selected, disabled.
- Preserve automatic selection-mode exit when a user deselects the last selected task after making a selection.
- Add regression coverage for list availability, Config exclusion, empty entry, action safety, and last-task deselection.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Extend bulk task planning with an explicit pointer-accessible empty-selection entry state and zero-selection toolbar safeguards.

## Impact

- Tasks list header actions and transient selection state in `TasksShell`.
- Tasks selection toolbar rendering and accessibility.
- Tasks component regression tests and durable personal Tasks specification.
- No database, Supabase, PowerSync, MCP, or dependency changes.

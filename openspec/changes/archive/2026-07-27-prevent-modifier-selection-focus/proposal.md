## Why

Modified-click task selection currently leaves browser DOM focus on the clicked task summary control. A later bare Shift press can then reveal a visible focus ring even though the user is still operating selection mode rather than keyboard traversal.

## What Changes

- Clear incidental DOM focus after Command-click, Control-click, or Shift-click establishes or changes task selection.
- Preserve the selected membership, stable range anchor, and all existing modified-click selection behavior.
- Prevent a bare modifier key from creating a visible whole-task or summary-control focus state.
- Add regression coverage for platform-modifier selection, Shift-click range selection, and subsequent bare Shift input.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Clarify that pointer-driven task selection does not retain DOM focus on the clicked summary control or reveal focus merely from a later modifier-key press.

## Impact

- Tasks selection event handling and task-row focus restoration in `src/modules/tasks/components/TasksShell.tsx`.
- Tasks selection regression tests.
- No data model, Supabase, PowerSync, MCP, or production migration impact.

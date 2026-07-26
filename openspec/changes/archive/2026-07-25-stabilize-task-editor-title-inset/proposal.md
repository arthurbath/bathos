## Why

The four-pixel space restored above the task editor's Title field currently participates in the disclosure's intrinsic height, causing the editor to appear to expand in two steps again. The visible separation should remain without introducing a second layout change during opening.

## What Changes

- Replace the task editor's layout-based top inset with an equivalent visual offset that does not contribute to disclosure height.
- Preserve the four-pixel separation above Title, existing field spacing, horizontal inset, and bottom padding.
- Verify that the offset remains steady throughout the editor's opening transition.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Require the fixed Title inset to remain outside the animated disclosure's intrinsic layout calculation.

## Impact

- Tasks editor layout in `src/modules/tasks/components/TasksShell.tsx`
- Tasks component regression coverage in `src/modules/tasks/components/TasksShell.test.tsx`
- No database, API, dependency, or cross-module impact

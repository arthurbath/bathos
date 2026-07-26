## Why

The floating New Task action currently anchors to the desktop viewport rather than the bounded Tasks list, which visually disconnects it from the content it controls. Its thin border and translucent hover surface also weaken the intended green outline treatment and allow task content to show through.

## What Changes

- Align the floating New Task action with the right edge of the responsive Tasks list at desktop widths while preserving the existing mobile inset and safe-area placement.
- Increase the action's outline from one pixel to two pixels.
- Use a fully opaque dark hover surface that may lighten without revealing content behind the action.
- Add regression coverage for the responsive boundary and visual-state classes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine the placement and visual treatment required for the primary floating task-creation action.

## Impact

- `src/modules/tasks/components/TasksShell.tsx`
- `src/modules/tasks/components/TasksShell.test.tsx`
- Tasks presentation only; no data, API, dependency, or Supabase changes.

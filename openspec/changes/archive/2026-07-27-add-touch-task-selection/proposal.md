## Why

Touch users need a direct gesture for beginning task multi-selection and a row-sized selection target once selection mode is active. The existing selection model is optimized for modified clicks and dedicated circular controls, making touch selection less immediate than the rest of Tasks.

## What Changes

- Add a touch-pointer-only left-swipe gesture on eligible task rows that enters selection mode and selects the swiped task.
- Preserve native vertical scrolling, browser edge gestures, ordinary taps, mouse input, trackpad input, and pen input.
- Make the complete task summary row toggle task membership while selection mode is active, regardless of how selection mode began.
- Rename the selection toolbar's `Select None` action to `Cancel`.
- Preserve automatic selection-mode exit when the final selected task is deselected.
- Continue using the existing native HTML drag-and-drop path for selected task groups without introducing a custom touch drag system or custom scrolling.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Extend task selection with touch-only swipe entry and revise selection-mode row activation and cancellation semantics.

## Impact

- Tasks-only interaction code in `src/modules/tasks/components/TasksShell.tsx`.
- Tasks shell regression coverage and rendered touch-emulation acceptance.
- No database, Supabase, PowerSync, MCP, service-worker, or dependency changes.

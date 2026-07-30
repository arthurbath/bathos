## Why

Task selection currently presents planning-specific and redundant exit actions, then clears selection after successful edits. A compact shared Edit menu will make bulk task editing match the familiar task ellipsis menu while preserving the user's working selection.

## What Changes

- Shorten the selection count to `X Task` or `X Tasks`.
- Replace the selection toolbar actions with `Select All`, `Edit...`, and `Cancel`.
- Present Start, Deadline, Area, Actionability, and Delete in the bulk Edit menu, matching the corresponding task ellipsis actions while omitting Repeat.
- Keep selection mode active after a bulk edit and retain every selected task that remains eligible for the current view.
- Remove selected tasks that leave the current view without exiting selection mode, including when no selected tasks remain.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine the selection toolbar, bulk edit menu, and post-edit selection retention contract.

## Impact

- Tasks selection toolbar and selection-owned command surfaces in `src/modules/tasks/components/`.
- Existing Tasks bulk mutation and visible-selection reconciliation behavior.
- Tasks component and interaction tests.
- No database, Supabase, PowerSync, native companion, or cross-module changes.

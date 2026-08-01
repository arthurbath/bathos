## Why

The checklist shortcut currently focuses an existing unchecked item and can place a newly created row after completed work. A shortcut-created item should instead enter the active portion of the checklist at the boundary before completed items.

## What Changes

- Make the checklist keyboard shortcut create and focus one fresh blank checklist item whenever the target task already has checklist content.
- Insert the fresh item immediately before the first completed checklist item.
- Append the fresh item when the checklist contains no completed items.
- Preserve the existing behavior that creates the first checklist item when no checklist exists.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine checklist shortcut insertion and focus behavior around completed checklist items.

## Impact

- Tasks checklist editor shortcut orchestration and ordered draft placement.
- Focused checklist editor and Tasks shell regression tests.
- No database, sync-schema, native-companion, or migration changes.

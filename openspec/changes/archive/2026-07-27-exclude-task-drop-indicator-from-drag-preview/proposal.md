## Why

The task-list drop-position indicator is layered across task rows while a native drag is active. Safari can capture that blue line in the browser-generated drag image, making the dragged task appear to carry the destination marker instead of leaving the marker anchored to the list.

## What Changes

- Give native task drags an explicit preview made from the task's summary content.
- Keep the blue drop-position indicator visible only in the list.
- Preserve existing task drag, bulk selection, drop projection, and persistence behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Keep task-list placement feedback out of the native task drag preview.

## Impact

- Updates task-row drag presentation and focused interaction tests under `src/modules/tasks/`.
- Updates the existing `personal-tasks-module` behavior contract.
- Does not change database objects, Supabase configuration, PowerSync topology, or external APIs.

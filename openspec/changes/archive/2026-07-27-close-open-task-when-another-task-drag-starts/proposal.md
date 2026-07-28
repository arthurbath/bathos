## Why

An expanded task consumes substantial list height while another task is being dragged. Leaving that unrelated editor open reduces the visible reorder range and makes it harder to place the dragged task among its peers.

## What Changes

- Close an open task when the user begins dragging a different task.
- Preserve autosave and refuse to discard an open editor if its pending changes cannot be flushed.
- Keep the existing behavior that collapses a task when the open task itself becomes the drag source.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Collapse an unrelated open task at the beginning of task-list reordering.

## Impact

- Updates task-list drag-start coordination and focused component tests under `src/modules/tasks/`.
- Updates the existing `personal-tasks-module` behavior contract.
- Does not change database objects, Supabase configuration, PowerSync topology, or external APIs.

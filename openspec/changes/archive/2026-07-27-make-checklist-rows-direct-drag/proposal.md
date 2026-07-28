## Why

Checklist reordering currently depends on a dedicated handle, even though the item surface itself can distinguish a click from a native drag. Letting the complete checklist row act as the drag source makes reordering faster and removes unnecessary visual chrome while preserving direct text editing on an ordinary click.

## What Changes

- Make persisted and transient empty checklist rows draggable from their row and text-input surfaces.
- Keep an ordinary click or tap on a checklist input focused for text editing.
- Begin native reorder behavior when the pointer gesture becomes a drag, without temporarily selecting an otherwise unselected item.
- Preserve selected-group dragging when the dragged row belongs to the checklist selection.
- Remove checklist reorder handles and reclaim their horizontal space.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Replace handle-dependent checklist reordering with direct checklist-row dragging while preserving click-to-edit and grouped reorder behavior.

## Impact

- Updates the checklist editor and its focused interaction tests under `src/modules/tasks/`.
- Updates the existing `personal-tasks-module` behavior contract.
- Does not change database objects, Supabase configuration, PowerSync topology, or external APIs.

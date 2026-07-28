## Why

Checklist reordering currently succeeds only when the native drag is released over a checklist-owned drop target. A user can see a valid insertion indicator, move the pointer elsewhere in BathOS, and release without the indicated reorder taking effect, which conflicts with the established task-list drag behavior.

## What Changes

- Retain the most recent valid checklist insertion position while a native drag remains active.
- Accept a drop anywhere inside the rendered BathOS document and commit the dragged checklist item or selected group at that retained position.
- Preserve ordinary native drag cancellation when the drag ends without a drop inside BathOS.
- Keep checklist-local drops single-shot and avoid a second document-level reorder.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Checklist single-item and grouped reordering will finalize at the last valid indicated position when the native drop occurs elsewhere inside BathOS.

## Impact

- Updates the Tasks checklist editor and its focused interaction tests.
- Does not change database schema, checklist persistence APIs, task-list drag behavior, or introduce a custom pointer/scroll system.

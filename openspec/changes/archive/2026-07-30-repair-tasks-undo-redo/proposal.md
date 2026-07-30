## Why

Tasks currently exposes undo and redo commands whose behavior depends on focus and mutation type. Native text-field focus can prevent the application history command from running, pending autosave can leave the intended change outside the projected history, and task creation is intentionally excluded from traversal, making common actions such as renaming and pasting appear non-undoable.

## What Changes

- Add temporary Undo and Redo controls to every task-list header, ordered before selection, find, and filter controls, with availability reflecting the same history arbitration used by keyboard commands.
- Make the application-owned undo and redo commands reliable in native and web shells even when a task editor field has focus.
- Flush pending task-editor autosave before traversing history so the visible edit is the action being undone.
- Treat task and checklist creation, deletion, reordering, metadata editing, completion, cut, copy-derived paste, and multi-item operations as coherent undoable actions.
- Preserve redo until the next forward mutation and invalidate it when a new branch is created.
- Add focused diagnostics and regression coverage for keyboard, pointer, native-command, pending-autosave, task-creation, checklist, and grouped-operation paths.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Make task and checklist mutations consistently undoable and redoable through keyboard, native, and visible list-header controls.

## Impact

- Tasks list-header controls and keyboard command routing.
- Task editor autosave coordination.
- Task and checklist history replay, safety checks, grouping, and repository operations.
- Supabase task-history trigger behavior if task-creation traversal requires an authoritative soft-delete/restore representation.
- Native command bridges and focused web/native regression tests.

## Why

Checklist mutations persist successfully, but the unified Tasks undo command only sees checklist history after the asynchronous history projection refreshes. An immediate undo after inserting, editing, completing, deleting, or reordering a checklist item can therefore report that there is nothing to undo or can traverse an older task action instead of the checklist action the user just performed.

## What Changes

- Associate every accepted checklist mutation with its exact history operation identifier and report that operation to the unified task-history controller.
- Treat a successfully accepted checklist mutation as immediately undoable while its authoritative history event is still being projected.
- Make undo wait for and traverse the matching checklist history operation, including grouped insertions, deletions, clipboard actions, and reorders, rather than selecting an event only from a stale timestamp snapshot.
- Preserve chronological interleaving between task and checklist history and preserve redo until a new forward action invalidates it.
- Add regression coverage for immediate checklist undo and redo across insertion, text editing, completion, deletion, and reordering, including delayed history projection and grouped operations.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Strengthen the unified task action history contract so accepted checklist mutations become immediately available to undo and redo even while their authoritative history events are still projecting.

## Impact

- Checklist mutation signaling and operation metadata in `useTaskChecklist`.
- Checklist history projection and traversal in `useTaskChecklistUndo`.
- Unified undo and redo routing in `TasksShell`.
- Checklist and shell history regression tests.
- No database migration or public API change is expected because checklist history rows already record operation identifiers.

## Why

Done currently exposes recoverably deleted checklist items as first-class entries and uses restore-oriented task language and iconography that obscures the distinction between completed and trashed to-dos. Done should remain a task-level terminal list while preserving checklist deletion history only for undo.

## What Changes

- Stop rendering recoverably deleted checklist items in Done without deleting their undo history.
- Present completed to-dos with the contained checked-square icon in semantic green.
- Present trashed to-dos with Lucide `SquareX` in neutral gray.
- Label the recovery action for completed and trashed to-dos as `Reopen` in both the leading control and ellipsis menu.
- Replace Delete with Reopen in the Done selection-mode Edit menu, recover mixed completed, canceled, and deleted selections through their appropriate guarded transitions, and keep Area and Actionability bulk editing available for terminal tasks.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine which terminal records Done presents and standardize task-level completion, deletion, and reopening semantics.

## Impact

- Tasks Done-list rendering, empty-state calculation, and selection-mode Edit menu.
- Canonical Tasks iconography and terminal task controls.
- Focused task-list, repository, and iconography tests. No database schema, synchronization, or native companion changes.

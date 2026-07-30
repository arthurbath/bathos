## Why

Task editing currently has four avoidable interruptions: Area changes can disturb focus or visible placement, global undo/redo can conflict with native field history, Escape does not consistently close the task after an inner surface is dismissed, and the floating creation action remains visually active while another task is already being added or edited.

## What Changes

- Preserve the active task field and caret when the Area shortcut changes task metadata.
- Keep an open task in its current visible and invisible list placement until the editor closes.
- Let the active task input own undo/redo while retaining persisted task-history undo outside inputs.
- Make Escape close only the deepest active task surface, then close the task editor on the next Escape.
- Fade and disable the floating creation action while a task metadata drawer is open, then restore it when the drawer closes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Stabilize Area changes, task-editor history ownership, layered Escape behavior, and the floating creation action during editing.

## Impact

- Tasks shell keyboard dispatch, open-task placement retention, editor focus, floating creation state, and regression tests.
- No database, Supabase, API, dependency, or migration changes.

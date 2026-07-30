## Why

Task editing currently has six avoidable interruptions: Area changes can disturb focus or visible placement, global undo/redo can conflict with native field history, Escape does not consistently close the task after an inner surface is dismissed, the floating creation action remains visually active while another task is already being added or edited, the open task does not use the established blue task-highlight surface consistently across its summary and metadata drawer, and a transient browser OPFS access-handle conflict can incorrectly surface as a failed Start-date command.

## What Changes

- Preserve the active task field and caret when the Area shortcut changes task metadata.
- Keep an open task in its current visible and invisible list placement until the editor closes.
- Let the active task input own undo/redo while retaining persisted task-history undo outside inputs.
- Make Escape close only the deepest active task surface, then close the task editor on the next Escape.
- Fade and disable the floating creation action while a task metadata drawer is open, then restore it when the drawer closes.
- Render open, keyboard-focused, and selected tasks with one continuous, subdued blue highlight surface.
- Retry task-planning transactions only when the browser reports the recognized transient OPFS access-handle conflict, using a short bounded schedule before surfacing a persistent failure.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Stabilize Area changes, task-editor history ownership, layered Escape behavior, the floating creation action during editing, the open task's visual surface, and transient local task-planning writes.

## Impact

- Tasks shell keyboard dispatch, open-task placement retention, editor focus, floating creation state, open-task styling, planning-transaction recovery, and regression tests.
- No database, Supabase, API, dependency, or migration changes.

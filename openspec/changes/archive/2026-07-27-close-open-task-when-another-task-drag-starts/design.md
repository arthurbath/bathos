## Context

Each task row owns its editor animation, while `TasksShell` owns the identity of the currently open task and the autosave boundary used to close it safely. A drag that begins on the open task already tells that row to collapse. A drag that begins on another row currently has no corresponding shell-level close request.

## Goals / Non-Goals

**Goals:**

- Reclaim the expanded editor's vertical space when another task begins dragging.
- Preserve pending autosave work before finalizing the close.
- Avoid moving keyboard focus back to the task being closed during the drag.
- Preserve native task drag, drop, selection, and ordering behavior.

**Non-Goals:**

- Change task editor close animation timing.
- Introduce a custom pointer drag system.
- Close a task after an autosave failure or discard unsaved edits.

## Decisions

- At parent-owned task drag start, compare the drag source with the current open task.
- When they differ, request `setOpenTask(null)` without awaiting it so native drag start remains synchronous.
- Reuse the normal autosave-aware close path rather than the keyboard-oriented close-and-focus helper.
- Leave the existing row-local collapse behavior in place when the open task itself is dragged.

## Risks / Trade-offs

- [Autosave may take longer than drag initialization] -> Start the close request immediately and let the existing editor close as soon as its save boundary succeeds.
- [Autosave may fail] -> Preserve the open editor rather than hiding unsaved work, matching the existing safe close contract.
- [A close helper could redirect focus during the drag] -> Use the neutral shell close path and do not focus the previously open row.

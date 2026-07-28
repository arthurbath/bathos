## Context

`TaskRow` currently marks the enclosing task article as draggable. Native HTML drag initiation therefore treats every descendant, including the expanded metadata editor and nested checklist interactions, as part of the task reorder surface. The summary row is already a discrete element and is the natural task-level drag handle.

## Goals / Non-Goals

**Goals:**

- Make the summary row the sole native drag source for task-level reordering.
- Preserve the enclosing article as the task-level drag-over and drop-position surface.
- Collapse an open metadata editor immediately when its summary row begins a drag.
- Preserve existing single-task, multi-task, cross-bucket, and automatic-sort drop behavior.

**Non-Goals:**

- Change checklist-item dragging.
- Add custom pointer dragging or custom autoscrolling.
- Change task ordering persistence or database behavior.

## Decisions

- Move the native `draggable` attribute and task drag-start ownership from the enclosing article to the title/summary control inside the summary row. This is the row's large, intentional grab surface, preserves the checkbox and ellipsis as direct controls, and makes descendant editor controls ineligible to initiate task-level dragging.
- Keep drag-over, drop-position calculation, and placement indicators on the enclosing task article. Its full collapsed height remains the correct target geometry for list placement.
- At summary drag start, synchronously begin the editor's local collapse animation and request the ordinary autosave-aware close path. If closing fails, restore the expanded editor state.
- Retain click suppression after a native drag so releasing the summary does not reopen the task.

## Risks / Trade-offs

- [Autosave failure during drag start could prevent the durable close] -> Collapse locally immediately, then restore the editor if the close request reports failure.
- [Moving `draggable` changes the DOM element used by tests and browser drag targeting] -> Add focused coverage for the new summary-only source and update reorder tests to initiate from the summary row.
- [Nested checklist drags could bubble into task drag handlers] -> The editor is outside the only draggable task source, and existing checklist drag isolation remains intact.

## Context

Task reordering uses native HTML drag-and-drop. The draggable title control sits inside a task card that also renders an absolutely positioned blue insertion marker. Browser drag-image capture can include overlapping painted content from that card, so Safari may show the insertion marker in the ghost that follows the pointer.

## Goals / Non-Goals

**Goals:**

- Keep the dragged task recognizable in the native drag preview.
- Exclude task-list placement feedback from that preview.
- Preserve the in-list blue insertion marker and native drag behavior.

**Non-Goals:**

- Replace native drag-and-drop with a custom pointer implementation.
- Change task ordering, bucket projection, selection, or drop finalization.
- Change checklist drag presentation.

## Decisions

- Build a temporary drag-image element from the task summary row at drag start and pass it to `DataTransfer.setDragImage`.
- Mark the preview as inert presentation, position it outside the visible viewport, and remove it after the browser captures the image.
- Remove any task drop-indicator descendants from the cloned preview defensively, even though the summary row normally excludes the marker.
- Preserve the pointer's horizontal and vertical position relative to the summary row when choosing the drag-image hotspot.
- Fall back to the browser's native preview if `setDragImage` is unavailable.

## Risks / Trade-offs

- [Native drag-image rendering differs among browsers] -> Use the standard `setDragImage` API, keep a native fallback, and cover the preview source and cleanup with component tests plus rendered browser inspection.
- [A temporary clone could become visible or interactive] -> Place it far outside the viewport, hide it from assistive technology, disable pointer interaction, and remove it on the next animation frame.

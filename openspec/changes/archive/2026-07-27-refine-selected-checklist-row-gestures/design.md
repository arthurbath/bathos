## Context

Checklist multi-selection is transient React state inside `TaskChecklistEditor`. Selected items already move as one visual-order group when a user drags a reorder handle, but a capture-phase document listener clears selection on an ordinary pointer press anywhere else. That listener prevents a selected row from becoming a second native drag surface.

## Goals / Non-Goals

**Goals:**

- Let the browser distinguish a click from a drag using its native movement threshold.
- Make any selected checklist row equivalent to its handle for beginning a selected-group drag.
- Make an ordinary click clear selection and enter the clicked checklist input for editing.
- Reuse the existing grouped reorder, retained drop position, drop ownership, and post-drop selection behavior.

**Non-Goals:**

- Building a custom pointer-drag or autoscroll system.
- Adding long-press timers or changing touch behavior beyond what native HTML drag already provides.
- Changing unselected checklist-row drag behavior, checkbox completion, keyboard selection, or checklist persistence.

## Decisions

1. **Apply native `draggable` only to selected persisted rows.** This lets the browser own the click-versus-drag threshold and avoids a custom gesture recognizer. The existing pointer-only handle remains available for all persisted and draft items.
2. **Defer deselection from `mousedown` to `click` for selected rows.** A selected row must remain draggable throughout the press. Native drags suppress the later click, while an ordinary release emits click and follows the edit path.
3. **Reuse the existing selected-group drag callback.** Row and handle drag starts both populate the same visual-order `draggedIds`, so drop calculation, persistence, and selected-state retention remain single-sourced.
4. **Preserve direct checkbox semantics.** An ordinary checkbox click clears checklist selection and toggles that one item without moving text focus. Clicking the input uses native caret placement. Clicking non-input row space focuses the corresponding input at the end.

## Risks / Trade-offs

- **Native drag behavior can vary over nested form controls** → Keep the explicit handle as the universal fallback and verify row drag initiation in the rendered target browsers.
- **A premature selection clear would cancel row dragging** → Preserve selection during capture-phase pointer-down inside a selected row and clear it only on click.
- **The parent row and child handle can both receive drag events** → Stop propagation at the child handle and row drag boundaries so initialization and cleanup occur once.

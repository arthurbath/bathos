## Context

Persisted selected checklist rows already use native HTML drag behavior across the row and input surface, but ordinary persisted rows and transient empty rows still require a dedicated handle. The editor also suppresses the click that native browsers can dispatch after a drag so input-originated drags do not unexpectedly restore the caret.

## Goals / Non-Goals

**Goals:**

- Treat every checklist row and checklist input as a native drag source.
- Preserve normal focus and caret placement when the gesture resolves as an ordinary click or tap.
- Reuse selected-group drag semantics when the dragged row is selected, and reorder only the origin item otherwise.
- Remove the dedicated reorder handle without reducing keyboard access to checklist editing.

**Non-Goals:**

- Introduce a custom pointer drag engine, custom auto-scrolling, keyboard reordering, or new checklist bulk actions.
- Change checklist persistence, history, completion, or drop-finalization behavior.
- Change task-level drag behavior.

## Decisions

- Keep native HTML drag-and-drop. Mark both the row and its input as draggable so browsers can establish the checklist row as the drag source even when the pointer begins over the text control.
- Generalize the existing small pointer-movement guard from selected inputs to every checklist input. Once movement indicates a drag, blur the input and suppress the generated post-drag click. An unmoved click remains native and places the caret normally.
- Resolve the moving set at drag start. A selected origin moves the selected items in visual order. An unselected origin moves only itself and does not acquire selection styling.
- Give the transient empty row the same direct-drag surface and existing draft reorder path. Its ordinary click remains text editing.
- Remove the visual handle and its Lucide import. The checkbox remains an independent completion control and does not become the intended drag target.

## Risks / Trade-offs

- [Native drag behavior differs subtly across browsers, especially over text inputs] -> Keep event handling limited to native draggable semantics, retain the post-drag click suppression, and cover click and drag branches with focused component tests plus rendered browser inspection.
- [Making the input draggable changes native text-drag selection behavior] -> This is intentional for checklist rows: ordinary clicks edit, while pointer drags reorder. Keyboard text selection remains unchanged.
- [Touch browsers may not provide desktop-style HTML drag behavior] -> Preserve tap-to-edit and avoid a custom touch drag system in this change.

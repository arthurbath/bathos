## Context

Selected checklist rows are native HTML drag sources. A press that begins over an input can focus that input before the browser emits `dragstart`, leaving a text caret visible even though the completed gesture is a group reorder rather than editing.

## Goals / Non-Goals

**Goals:**

- Ensure an input-originated selected-row drag finishes without an active checklist text input or visible caret.
- Retain the browser's native drag threshold and the existing selected-group reorder implementation.
- Preserve the clicked caret position for a press and release that never becomes a drag.

**Non-Goals:**

- Replacing native drag-and-drop with a custom pointer system.
- Changing selection gestures, checklist ordering, or persistence.

## Decisions

- Clear focus when native `dragstart` confirms that the gesture became a drag. This preserves native input caret placement for a genuine click while removing the focus before the reorder continues.
- Keep ordinary click handling unchanged. If no drag starts, the click clears checklist selection and explicitly restores focus to the clicked input.
- Exercise the input-originated path in component tests by focusing the input before dispatching `dragstart` on its selected row.

## Risks / Trade-offs

- **Risk:** An input may receive focus briefly between pointer-down and native drag initiation. → **Mitigation:** Native `dragstart` is the earliest reliable signal that distinguishes a drag from a click without replacing browser drag behavior, and focus is cleared immediately at that boundary.
- **Risk:** Drag cleanup might inadvertently restore focus. → **Mitigation:** The drag path only clears focus; focus restoration remains confined to the ordinary click handler.

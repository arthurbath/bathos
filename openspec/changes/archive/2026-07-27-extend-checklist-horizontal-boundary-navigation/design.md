## Context

The Tasks checklist editor renders each checklist line as an independent text input but already treats the inputs as one keyboard-editable surface for Return, Backspace, forward Delete, Up Arrow, and Down Arrow. Horizontal arrows remain native within an input and currently stop at its boundaries.

## Goals / Non-Goals

**Goals:**

- Continue horizontal caret movement into an adjacent checklist input only when the current selection is a collapsed caret at the relevant string boundary.
- Support both persisted checklist items and the unsaved draft row in their current visual order.
- Preserve native Left Arrow and Right Arrow behavior everywhere else.

**Non-Goals:**

- Selecting text across checklist inputs.
- Wrapping from the first item to the last or from the last item to the first.
- Changing checklist persistence, ordering, animation, or data contracts.

## Decisions

- Reuse the editor's visual checklist ID sequence so horizontal and vertical navigation agree about persisted and draft row order.
- Extend the existing pending-focus request to accept `start` or `end`, placing Left Arrow at the preceding value's end and Right Arrow at the following value's beginning.
- Intercept a horizontal arrow only for a collapsed caret at the relevant boundary and only when an adjacent checklist input exists. Native input behavior remains responsible for selections, modifier-assisted arrows, and movement within a value.

## Risks / Trade-offs

- **Risk:** A browser-native text-selection gesture could be overridden. **Mitigation:** Require no Command, Control, Alt, or Shift modifier and a collapsed selection before crossing inputs.
- **Risk:** Unsaved draft placement could diverge from persisted order. **Mitigation:** Derive both horizontal and vertical traversal from the same visual ID sequence.

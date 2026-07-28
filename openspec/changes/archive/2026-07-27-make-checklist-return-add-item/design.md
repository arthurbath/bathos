## Context

The ordinary BathOS form contract now submits single-line controls with Return unless the field owns that key. A checklist item is technically a single-line input, but conceptually it is one row in a continuing list editor. Its current Return behavior therefore reaches the task form and closes the editor, interrupting checklist entry.

## Goals / Non-Goals

**Goals:**

- Make checklist entry continuous by creating and focusing a new row on Return.
- Give every checklist item the concise `Item` placeholder.
- Prevent the same Return event from reaching the surrounding task form.
- Preserve native input-method composition and current persistence behavior.

**Non-Goals:**

- Change checklist storage, ordering, completion, deletion, or cleanup.
- Add a multiline checklist item or split one item's existing text.
- Change Return behavior for other BathOS inputs.

## Decisions

- Handle Return in the checklist input's keydown path before the shared form command listener. This is the narrowest field-owned exception and leaves global form behavior intact.
- Ignore Return while composition is active. The input method remains authoritative until composition ends.
- Persist the current checklist row through its existing commit path before creating a new empty row.
- Present the existing empty draft row and focus it after the current row has committed. Persistence remains deferred until the user gives the draft nonempty text.

## Risks / Trade-offs

- [Rapid projection can make focus timing nondeterministic] → Retain an explicit pending-focus identifier and focus only when that row is rendered.
- [A failed current-row commit or row creation could close the task if the event escapes] → Prevent default and propagation before awaiting persistence, then retain the current editor state on failure.
- [Repeated Return could create duplicate empty rows] → Reuse the component's pending mutation guard and test one keypress as one creation.

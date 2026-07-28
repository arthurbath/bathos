## Context

Task rows currently share one selection handler across their activation surface and selection-mode state. Once explicit selection is active, that handler interprets an ordinary row click as another selection toggle instead of the row's ordinary open action. The circular selection control is already a distinct target and can carry the unmodified toggle interaction by itself.

## Goals / Non-Goals

**Goals:**

- Keep row-level selection explicit through Command-click, Control-click, or Shift-click.
- Let the circular selection-mode control toggle its task with an ordinary click.
- Let an ordinary activation-surface click abandon the current selection and open the clicked task.
- Preserve direct checkbox, source-link, Primary Link, and ellipsis behavior.

**Non-Goals:**

- Changing keyboard focus, keyboard selection, bulk toolbar, drag-and-drop, or range-anchor semantics.
- Changing database state, task persistence, or terminal lifecycle rules.

## Decisions

- Dispatch by pointer target and modifiers before consulting selection-mode state. The selection circle owns ordinary selection toggling, while the task activation surface owns ordinary opening.
- Keep modified activation-surface clicks on the existing explicit-selection path so range and additive selection remain unchanged.
- Clear explicit selection before opening the clicked task so the interaction never leaves the editor and bulk toolbar active simultaneously.
- Test the distinction at the Tasks shell level because the regression depends on coordinated row, selection, and editor state.

## Risks / Trade-offs

- **Risk:** The row click can bubble from a nested direct-action control and accidentally open the task.
  **Mitigation:** Preserve propagation guards and direct-control exclusions before the activation-surface handler.
- **Risk:** Clearing selection and opening in separate state transitions can briefly expose an intermediate state.
  **Mitigation:** Perform both changes inside the same React event and assert the resulting toolbar/editor state.

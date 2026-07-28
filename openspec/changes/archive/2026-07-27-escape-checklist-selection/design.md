## Context

Checklist multi-selection already owns document-level keyboard handling for grouped deletion and printable-key suppression. Escape currently reaches the surrounding task editor, where it can close the task instead of canceling the more deeply nested checklist selection state.

## Goals / Non-Goals

**Goals:**

- Make unmodified Escape clear active checklist selection.
- Keep the task editor open and leave checklist data unchanged.
- Prevent the handled Escape action from reaching task-level or page-level shortcuts.
- Cover both additive Command-click and range Shift-click selection paths.

**Non-Goals:**

- Changing Escape behavior when checklist selection is inactive.
- Moving keyboard focus into a checklist item after cancellation.
- Changing checklist deletion, completion, or reordering behavior.

## Decisions

### Handle Escape in the existing checklist-selection keydown owner

The checklist editor's document-level capture handler will recognize unmodified Escape before its deletion and printable-key branches. While at least one checklist item is selected, it will prevent the browser default, stop propagation, clear the transient selection and return.

This keeps ownership with the deepest active interaction layer. It also reuses the existing selection cleanup path, including anchor cleanup, without adding a competing task-level shortcut.

### Preserve focus absence

Canceling selection will not focus an item or another control. Checklist selection deliberately relinquishes text-entry focus, and Escape should only cancel that selection state.

## Risks / Trade-offs

- **Outer Escape actions could still run if the event escapes the checklist handler.** The handler runs in capture phase and explicitly prevents and stops the event while selection is active.
- **Modified Escape combinations could be intercepted unintentionally.** Only unmodified, non-composing Escape is handled.

## Migration Plan

No database, data, or deployment migration is required. The change is limited to client interaction behavior and regression coverage.

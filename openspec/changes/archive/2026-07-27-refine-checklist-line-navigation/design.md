## Context

`TaskChecklistEditor` renders persisted checklist items plus at most one local empty draft row. It currently preserves focus through a shared pending-focus request, but Return always creates a blank row and a FLIP-style layout effect animates every checklist position change. Native single-line input ArrowUp and ArrowDown behavior also conflicts with the intended multi-line mental model.

## Goals / Non-Goals

**Goals:**

- Make Return split the active checklist value at the exact selection or caret boundary.
- Make vertical arrows traverse adjacent checklist inputs with deterministic end-of-value placement.
- Remove motion caused by checklist item creation and deletion.
- Preserve native behavior at outer checklist boundaries and preserve completion-reorder motion.

**Non-Goals:**

- Supporting multi-row text selection or changing native Command/Control+A behavior.
- Changing checklist persistence, history, drag reordering, or database schema.
- Removing the animation that moves a newly completed checklist item beneath incomplete items.

## Decisions

1. Treat a selection as the split boundary. Text before `selectionStart` remains in the current row and text after `selectionEnd` becomes the new row. Selected text is replaced by the line break, matching ordinary text editing expectations.
2. Keep one local draft row for the newly created suffix. Persist the current row immediately through the existing mutation path, then focus the draft at its beginning.
3. Route ArrowUp and ArrowDown through parent-owned callbacks so persisted and draft rows share one visual-order model. Destination focus always uses the existing `end` caret request.
4. Prevent default only when an adjacent checklist row exists. At the first row for ArrowUp and the final row for ArrowDown, leave native input behavior intact.
5. Remove the general row-position FLIP layout effect and row transition classes. Completion reordering retains a narrow, completion-owned animation rather than applying motion to all list mutations.

## Risks / Trade-offs

- [Risk] Async persistence can briefly expose a draft while the current row is saving. → Keep focus local and rely on the existing optimistic editing title until the mutation resolves.
- [Risk] Removing the general layout effect could also remove completion motion. → Add completion-specific motion keyed only to completion state transitions.
- [Risk] Vertical arrows conventionally move within multiline text. → These are single-line checklist inputs, and the explicit cross-row behavior fulfills the user-defined composite editor contract.

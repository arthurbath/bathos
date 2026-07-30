## Context

Tasks already autosaves accepted metadata immediately and retains a snapshot of an open to-do's original list-placement fields. That snapshot is used while deriving current-view membership and visible sections. The close path also supports a short retained-placement interval so the drawer can collapse before the row is removed or repositioned.

The weakness is in deciding whether the close path needs that retained interval. The decision covers Start, Deadline, area, horizon, and order changes, but it does not cover every projection determinant. In particular, actionability can change automatic sorting or quick-filter membership. A task can therefore release its retained projection in the same render that begins closing the drawer.

## Goals / Non-Goals

**Goals:**

- Keep the open task in its original list, visible bucket, and exact ordering slot through every accepted metadata edit.
- Reflect accepted metadata immediately inside the summary and drawer while continuing immediate autosave.
- Use the same retention behavior for editor controls and keyboard shortcuts.
- Keep the retained projection until the drawer-close transition is complete, then reconcile exactly once.
- Cover list departure, quick-filter departure, visible regrouping, and automatic-sort movement.

**Non-Goals:**

- Buffering metadata writes until close.
- Adding Save or Cancel semantics to the autosaving editor.
- Changing completion, deletion, multi-selection, drag-and-drop, persistence, synchronization, or database behavior.
- Retaining a closed task indefinitely after it no longer belongs in the current projection.

## Decisions

### Treat placement retention as an editing-session projection concern

The persisted and optimistic task continues to carry its latest accepted metadata. Rendering alone substitutes the captured placement fields while the task is open or completing its close transition.

This preserves immediate autosave and undo history while preventing the list structure from reacting during editing. Buffering persistence until close was rejected because it would weaken autosave, cross-device synchronization, and established undo behavior.

### Recognize every projection-changing close

The close path will retain the task when either:

- a placement determinant changed, including actionability, or
- the final metadata no longer belongs to the current list or current quick filter.

This makes the release decision align with the same current-view and filtering rules used for rendering and departure messaging. Special-casing only pointer controls or individual shortcuts was rejected because all mutation paths converge on the same accepted task state.

### Release through the ordinary close lifecycle

The open-task identity is replaced temporarily by the closing-task identity while the drawer collapses. Only after that lifecycle completes is the retained snapshot released, allowing the current projection to remove, regroup, or reorder the task once.

## Risks / Trade-offs

- **A projection field is added later without being included in close-settling detection** → Keep the detector explicit and cover automatic-sort and quick-filter cases in regression tests.
- **Rapid open/close or opening another task races the retained interval** → Continue using the existing close sequence guard and closing-task identity.
- **A task visibly pauses before moving after close** → Keep the existing brief settle interval and respect reduced-motion preferences.
- **Persisted metadata and visible bucket temporarily differ** → This is intentional while the drawer is open; the current field values remain visible in the row and editor.

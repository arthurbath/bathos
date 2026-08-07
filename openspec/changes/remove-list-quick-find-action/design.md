## Context

Tasks currently renders a Quick Find button beside Undo, Redo, Selection, and Quick Filters on primary lists. Quick Find already opens from unmodified printable input on eligible point-and-click surfaces and from a pull-down gesture on touch lists. The durable spec contains both a typing-only requirement and a later contradictory visible-button requirement.

## Goals / Non-Goals

**Goals:**

- Remove the visible Quick Find list action from every primary list.
- Preserve type-to-search and touch pull-down access unchanged.
- Resolve the contradictory durable requirement through a removal delta.

**Non-Goals:**

- Change Quick Find results, routing, layout, focus, or dismissal behavior.
- Remove the full Search route or any keyboard shortcut documentation.
- Change Undo, Redo, Selection, or Quick Filters actions.

## Decisions

- Remove the button at the shared list-action rendering point so every list remains consistent.
- Update tests that use the button only as setup to open Quick Find through printable-key activation instead. This keeps those tests aligned with a supported user path.
- Retain direct state-opening helpers used by the touch pull-down gesture and other internal flows.

## Risks / Trade-offs

- [Risk] A point-and-click user may not discover type-to-search. → Touch devices retain the pull-down gesture, and the existing keyboard-shortcuts surface documents Quick Find access where applicable.
- [Risk] Removing the button could accidentally remove the entire action row. → Add focused assertions that the button is absent while the remaining actions preserve their order.

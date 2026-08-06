## Context

`TaskQuickFindDialog` owns the visible query while `TasksShell` owns whether the palette is open and the seed used when it opens. Ordinary dismissal already clears the dialog-owned query, but task, recurrence, and exhaustive-search activations close the palette through parent callbacks, bypassing that local reset until a later render.

## Goals / Non-Goals

**Goals:**

- Treat the query as transient state belonging to one Quick Find session.
- Clear it synchronously for every close and destination-activation path.
- Preserve the query long enough to construct the full Search URL when See All Results is activated.

**Non-Goals:**

- Change result ranking, routing, keyboard navigation, or the full Search page query.
- Persist Quick Find query state across sessions.

## Decisions

The dialog will expose one reset-and-close operation and use it for dismissal as well as result activation. Destination activation captures any required URL first, clears the query, closes the palette, and then invokes the existing navigation callback. This keeps ownership of the transient value beside the input rather than relying on every parent callback to recreate the same cleanup.

An alternative was to remount the dialog whenever it opens. That would discard all local state, but it introduces unnecessary component churn and makes correctness depend on mount timing rather than the explicit end of a Quick Find session.

## Risks / Trade-offs

- **Risk:** Clearing before See All Results could erase the query used in its destination URL. **Mitigation:** Construct and capture the destination before resetting local state.
- **Risk:** Closing both locally and in the existing parent callback duplicates an idempotent state update. **Mitigation:** Keep the parent closure for routing ownership while centralizing query reset in the dialog.

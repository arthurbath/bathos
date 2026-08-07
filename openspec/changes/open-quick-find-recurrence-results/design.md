## Context

Quick Find represents recurrence definitions as destinations in Upcoming. Ordinary task destinations pass through the task-opening transaction, which clears prior whole-task focus before opening the target. The recurrence branch currently only closes an ordinary editor and relies on a row-focus request, leaving stale ordinary focus state and never opening the prototype drawer.

## Goals / Non-Goals

**Goals:**

- Give Quick Find recurrence destinations the same open-destination semantics as ordinary task destinations.
- Preserve exactly one whole-task focus owner during the transition.
- Reuse the existing guarded recurrence-prototype opening transaction.

**Non-Goals:**

- Opening the separate Edit Repeat modal.
- Changing recurrence data, search ranking, result rendering, or route selection.
- Changing pointer and keyboard behavior when a prototype is activated directly in Upcoming.

## Decisions

### Route recurrence search targets through the prototype-opening transaction

After navigation reaches Upcoming and the target prototype is present, the search-target effect will call the same `setOpenRecurrencePrototype` transaction used by direct prototype activation. This safely closes any ordinary editor and opens the inline prototype metadata drawer. Merely focusing the prototype row was rejected because it produces different behavior from ordinary Quick Find destinations.

### Clear stale ordinary whole-task focus after the open transaction succeeds

The transition will clear the prior ordinary-task focus owner only after the guarded prototype-opening transaction succeeds. The existing recurrence focus request remains responsible for transferring DOM focus and clearing the transient search target. Clearing focus before the transaction was rejected because a failed autosave or close should not leave the current task in an unexplained focus state.

### Preserve the explicit repeat-edit workflow

Quick Find opens only the ordinary prototype metadata drawer. The Edit Repeat modal remains an explicit secondary action because cadence changes use a separately committed form.

## Risks / Trade-offs

- **Risk:** The destination prototype is not yet available immediately after navigation. **Mitigation:** Wait for the Upcoming route and projected recurrence collections before opening.
- **Risk:** A failed close of the current editor could strand the search target. **Mitigation:** Keep the target pending and preserve the current focus owner unless the guarded transaction succeeds.

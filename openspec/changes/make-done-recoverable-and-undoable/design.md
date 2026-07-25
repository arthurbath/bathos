## Context

The task table already models lifecycle (`open`, `completed`, `canceled`) separately from disposition (`present`, `deleted`). Database triggers append complete before/after snapshots to `tasks_history_events`, and guarded undo/redo can traverse completion and deletion states without a schema change.

The remaining failure is client coordination. A forward write receives its mutation identifier inside the repository transaction, but the task can start leaving its source list before the resolved task is registered with the history hook. Command-Z during that interval sees only the previously projected history tip. Done compounds the conceptual mismatch by rendering completed and deleted tasks as archive rows with separate textual actions.

## Goals / Non-Goals

**Goals:**

- Make immediate undo deterministic even when the forward write or its PowerSync history projection has not completed.
- Apply the same reservation contract to every user-editable task mutation path.
- Preserve exact-event safety: never substitute an older or unrelated event while waiting.
- Make completed and deleted task states visibly and directly recoverable from Done.
- Preserve local-first operation, append-only history, redo, hierarchy restoration, and retention.

**Non-Goals:**

- Add a second history system, an in-memory-only inverse, or browser-native undo.
- Change task lifecycle/disposition columns or their Supabase constraints.
- Change the 31-day retention job or make permanent deletion user-triggerable.
- Make deleted task metadata editable before restoration.
- Change project, area, or checklist-item recovery controls in this slice.

## Decisions

### Reserve forward mutations before asynchronous work

The history hook will expose a reservation object created synchronously before a repository mutation begins. The reservation has a stable client-only identity, knows the affected task, and is settled exactly once with either the returned task and its accepted `client_mutation_id` or cancellation after failure.

When undo is requested, the hook anchors to the newest reservation first. It waits for an unresolved reservation to settle, then waits for the exact matching history event and exact matching task projection before calling guarded repository undo. This closes both gaps: mutation-in-flight and server-history-projection-in-flight.

Generating a database mutation identifier in the UI was rejected because repository and hierarchy mutation paths own idempotency and may return multiple task mutations. Blocking task exit until history projection was rejected because it would make ordinary task completion feel network-bound.

### Keep exact-event traversal authoritative

The client will not synthesize lifecycle patches or apply an optimistic undo outside the repository. Database snapshot comparison and trigger classification remain the authority. If the reserved mutation fails, times out, or is superseded by an intervening accepted mutation, undo safely reports no traversal rather than applying stale state.

Terminal timestamp equality is instant-based rather than representation-based. JavaScript writes UTC instants with a `Z` suffix while PostgreSQL JSON snapshots may project the same instant with a numeric UTC offset. The client normalizes those valid timestamp representations at microsecond precision before snapshot comparison, while still rejecting different instants and malformed values. This keeps completion, cancellation, and deletion undo safe without mistaking serialization differences for intervening edits.

A cursor tip can also become historically valid but presently non-traversable, such as an inverse that would restore a Start whose date has already passed. Repository validation classifies that condition as an unavailable history boundary. The interface reports Nothing to Undo or Nothing to Redo using an ordinary toast, while transport, storage, and unexpected mutation failures remain destructive errors.

Redo accepts both platform-standard forms: Command-Y and Command-Shift-Z on Mac, and Control-Y and Control-Shift-Z on Windows. Tasks captures either form before editable controls or browser handlers.

### Treat Done as a projection of recoverable task states

Completed present tasks will use a checked square control in the same leading position as an active task checkbox. Activating it performs `reopen`, clearing completion and returning the task to the planning state already retained in its snapshot. Canceled present tasks retain a distinct canceled indicator but use the same direct reopen control.

Deleted task roots will use an icon-only restore button in that leading position. Its resting icon is `Trash2`; hover and keyboard focus reveal `RotateCcw`. The task title, terminal date, source indicator, focus, and selection behavior remain task-row content rather than an archive card with a separate Restore button.

### Preserve existing terminal timestamps

`completed_at`, `canceled_at`, and `deleted_at` remain the Done ordering and retention timestamps. Reopen or restore clears only the relevant terminal state through existing transitions. No synthetic done-date column is needed.

## Risks / Trade-offs

- [A mutation promise never settles] -> Bound the undo wait and cancel reservations on every caught repository failure.
- [Concurrent autosaves create several reservations] -> Preserve reservation order and always anchor undo to the newest started forward mutation.
- [A projected event arrives before its task row] -> Require both the exact event and matching snapshot, continuing the bounded wait until both agree.
- [A terminal timestamp projects in different ISO spellings] -> Compare valid timestamp values as microsecond-precise instants and keep null, malformed, or genuinely different values unequal.
- [An old event would restore data that violates current invariants] -> Stop at that cursor boundary and report neutral unavailability without attempting a stale or invalid write.
- [A task is restored through a hierarchy operation] -> Keep deletion restoration on the existing cascade repository path; the Done control only changes its presentation and invocation point.
- [Done rows diverge from active card styling] -> Reuse the Tasks planning-card frame/background constants and add component regressions for controls, focus, and source links.

## Migration Plan

1. Add the reservation API and integrate it into all list-level task mutation paths.
2. Add exact completion, immediate Command-Z, projection-delay, failure, and redo tests.
3. Replace completed/deleted Done row controls and add pointer, hover/focus, keyboard, and restoration tests.
4. Run repository, hook, shell, full Vitest, lint, task typecheck, build, and strict OpenSpec validation.
5. Verify the rendered Done surface and keyboard capture in the local web runtime without mutating personal production task data.

No database or production migration is required. Rollback consists of reverting the client and spec changes.

## Open Questions

None.

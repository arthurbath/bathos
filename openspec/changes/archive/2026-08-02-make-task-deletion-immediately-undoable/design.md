## Context

Task deletion already uses the recoverable hierarchy transition and the database writes a valid append-only delete history event. Production inspection confirmed that the newest delete event carries the accepted client mutation identifier, matches the deleted task snapshot, and is newer than every other accepted user event. The failure is therefore in the client cursor's projection and availability coordination: the deletion can visually settle while the client still exposes no undoable action.

The undo system must remain projection-safe. It cannot guess an inverse state, skip backward to an older action, or mutate from a stale snapshot merely to make the control feel immediate.

## Goals / Non-Goals

**Goals:**

- Preserve the exact deletion reservation from invocation through accepted history projection.
- Make Undo acknowledge and retain a request for that exact deletion during bounded projection lag.
- Restore the deleted hierarchy and prior task planning state once the guarded snapshot pair is available.
- Cover both immediate and already-projected delete undo behavior with deterministic tests.

**Non-Goals:**

- Changing deletion from recoverable to destructive.
- Adding new history tables, RPCs, PowerSync tables, or migrations.
- Allowing an unsafe inverse when the synchronized task no longer matches the deletion snapshot.
- Redesigning general Undo and Redo UI.

## Decisions

### Treat an accepted deletion reservation as current undo intent

The client will keep the mutation reservation addressable until its exact accepted history event and deleted task snapshot are safe to traverse. This uses the same contract as completion instead of relying only on the asynchronously reconstructed cursor.

Alternative considered: enable Undo from the pre-delete snapshot alone. Rejected because it could restore a task whose authoritative delete failed or whose state changed on another client.

### Derive availability from one coherent projected history state

The client will avoid exposing a transient empty cursor when history rows and their task projections arrive in separate renders. Cursor reconstruction and task-snapshot validation must refer to the same latest projected event set.

Alternative considered: add a delay before removing the deleted task from the list. Rejected because it masks the race and makes deletion feel slower without making Undo correct.

### Keep server behavior unchanged

The existing hierarchy delete and history trigger produce the required event and snapshot. The repair remains in the Tasks client and its tests.

## Risks / Trade-offs

- [Projection never converges] -> Retain the existing bounded wait, perform no inverse, and never fall through to an unrelated older history action.
- [A concurrent device changes the deleted task] -> Keep exact snapshot matching and report the neutral unavailable boundary.
- [Client cursor races during query changes] -> Add regression coverage that separately advances task mutation, history projection, and deleted-task projection.

## Migration Plan

Ship as a backward-compatible web/native-hosted client update. No database migration or data rewrite is required. Rollback is the prior client bundle.

## Open Questions

None.

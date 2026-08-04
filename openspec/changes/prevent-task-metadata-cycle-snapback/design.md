## Context

Task lists merge watched PowerSync query rows with a short-lived in-memory optimistic task overlay. After a metadata write succeeds, the hook replaces its speculative row with the repository's accepted task revision. The current reconciliation effect removes that accepted overlay as soon as the watched query emits the same mutation identifier. If synchronization subsequently emits an older server projection before returning to the accepted revision, the older row becomes visible and produces the observed new-old-new flash.

Today horizon shortcuts use the task move path, while Area and Actionability shortcuts use task updates. Both paths converge through the same optimistic task overlay, so the correction belongs in the shared list hook rather than in individual shortcut handlers or metadata controls.

## Goals / Non-Goals

**Goals:**

- Keep the newest accepted local task revision continuously visible while reactive local and remote projections converge.
- Apply the same protection to horizon moves and ordinary metadata updates.
- Permit a genuinely newer authoritative task revision to replace the retained local revision.
- Reproduce the local-echo, stale-remote-echo, accepted-state sequence in hook regression tests.

**Non-Goals:**

- Change shortcut assignments or cycling order.
- Change repository, PowerSync, Supabase, or task mutation contracts.
- Introduce timers or animation delays to conceal the stale render.

## Decisions

### Treat the accepted local revision as a high-water display value

The speculative optimistic overlay will retain its existing lifecycle and retire after the watched query observes its accepted mutation. A separate accepted-revision high-water map will retain the repository result and substitute it only when the watched query still contains that task at an older revision. The high-water value will not resurrect a task that is absent from the current view. A strictly newer query revision, or an equal revision with a different mutation identifier, supersedes the high-water value.

This uses the task's existing monotonic revision and mutation identifier rather than elapsed time. A timeout was rejected because it could merely move the flash later or retain stale UI for an arbitrary duration.

### Reconcile once in `useTaskList`

The shared hook will own the rule for every task mutation path. Adding separate pending state to horizon, Area, and Actionability controls was rejected because it would duplicate synchronization behavior and leave other metadata writes susceptible to the same regression.

### Test the synchronization sequence below the shortcut layer

Hook tests will drive both the move path used by horizon cycling and the update path used by Area and Actionability cycling. Each test will emit the accepted local row, then an older query row, and finally a newer authoritative row. Existing shell tests continue to cover command routing.

## Risks / Trade-offs

- [Risk] Accepted task rows remain in an in-memory high-water map longer than the speculative overlay. -> The map is scoped to the mounted list hook, does not inject absent tasks, and is removed by a newer or divergent authoritative revision.
- [Risk] A same-revision conflict could otherwise be hidden. -> A different mutation identifier at the same revision is allowed to supersede the retained row.
- [Risk] Revision ordering assumptions could drift. -> Regression tests encode both rejection of older rows and acceptance of newer rows using the repository's existing revision contract.

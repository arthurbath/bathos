## Context

Task deletion already has per-task optimistic projection: beginning a recoverable deletion hides that task, and a rejected mutation removes the optimistic override so the authoritative task reappears. Selection-mode deletion currently awaits each task transition inside a serial loop, however, so the next optimistic hide does not begin until the preceding persistence request settles. The result makes one user action look like a slow sequence of unrelated deletions.

The existing repository contract intentionally persists each hierarchy root through its guarded lifecycle operation. This change must preserve that authority, history, and rollback behavior without introducing a new database surface.

## Goals / Non-Goals

**Goals:**

- Hide the complete selected group in one optimistic React render.
- Begin every selected deletion before waiting for persistence.
- Preserve one undoable operation identity for the grouped user action.
- Restore only failed tasks and report partial or complete failure once.
- Keep structured diagnostics free of task IDs, titles, notes, links, checklist content, and other user-authored data.

**Non-Goals:**

- Replacing the existing guarded per-task repository operation with a database batch mutation.
- Changing single-task terminal animations or repository invariants.
- Making a partial server-side failure appear atomic after authoritative results arrive.
- Changing selection reconciliation beyond the existing removal of tasks that leave the active view.

## Decisions

### Launch every deletion synchronously, then await all results

The shell will map the selected targets to transition promises before awaiting any promise and will settle the group with `Promise.allSettled`. Each transition therefore installs its existing optimistic removal during the same input event and React batches the state updates into one render. `allSettled` is required so one rejection cannot stop the shell from observing the remaining results.

The alternative was a new list-level optimistic overlay followed by the existing serial loop. That would duplicate projection state, retain the slow persistence path, and create two rollback authorities.

### Reuse one operation identity across the group

Every selected transition will receive the same generated operation ID. This preserves the existing history grouping and one-action undo semantics while each root continues through its own validated repository operation.

### Keep rollback per task and failure feedback per user action

Each rejected transition continues to clear its own optimistic removal, so only unsuccessful tasks reappear. Once all results settle, the shell presents one concise error notification and emits one console/Sentry report summarizing requested, successful, and failed counts plus the active view and network state.

The structured report will not contain task identifiers or user-authored content. The aggregate technical error remains available to the console and Sentry exception mechanism for diagnosis.

## Risks / Trade-offs

- **A partial failure can leave the group split between Done and the active list** -> Restore only rejected tasks, report the group failure once, and preserve successful authoritative deletions rather than issuing compensating mutations.
- **React batching behavior could regress if transitions stop installing optimistic state synchronously** -> Add a shell regression test proving every transition begins before any promise resolves and a task-list test proving concurrent optimistic deletion plus selective rollback.
- **Multiple rejected promises could produce noisy telemetry** -> Emit one aggregate report for the user action while retaining the individual technical reasons inside the captured exception.
- **Telemetry could expose private task content** -> Restrict structured context to counts, view, online state, and fixed operation tags.

## Migration Plan

No schema, data, PowerSync, Supabase, Edge Function, or native migration is required. Deploy the web-compatible shell and reporting code through the normal release path. Rollback consists of restoring the prior serial orchestration and removing the new diagnostic helper.

## Open Questions

None.

## Context

Tasks already indexes active and Done task roots for full Search, but Quick Find currently filters the same task collection down to open, present tasks. Done already has a server-side automatic purge and a two-step permanent-deletion service, but the RPC scope currently accepts only recoverably deleted roots and the Done UI does not expose it.

This change crosses the Tasks React UI, the existing Tasks Supabase RPC contract, and the personal Tasks specification. It must preserve owner authorization, idempotent deletion receipts, recurrence receipts, and the distinction between ordinary recoverable Delete and irreversible deletion from Done.

## Goals / Non-Goals

**Goals:**

- Make Quick Find and full Search agree about whether a matching task exists.
- Distinguish retained Done matches as `Completed` or `Deleted` without displacing stronger Summary matches.
- Let a user permanently delete any retained task root from Done through the existing preview-and-confirmation protocol.
- Keep automatic purge behavior unchanged and explain it accurately in Done.
- Preserve owner scoping, stale-preview rejection, content-free safety receipts, and recurrence safety receipts.

**Non-Goals:**

- Change the 30-day retention boundary or cron cadence.
- Make permanent deletion undoable.
- Add permanent deletion to active planning lists, Quick Find, or full Search.
- Surface deleted checklist items or hierarchy roots as task search results.
- Permanently delete user data during browser acceptance testing.

## Decisions

### Use one shared task index for Quick Find

Quick Find will search the same owner task-root collection as full Search instead of prefiltering to open tasks. Existing relevance ranking remains unchanged, so exact, prefix, and substring Summary matches continue to outrank ancillary metadata matches regardless of lifecycle.

Alternative considered: retain the active-only top three and show Done matches only through See All Results. This preserves the current code but recreates the user-facing contradiction the change is intended to remove.

### Derive one explicit Done status label

A result with `disposition = deleted` is labeled `Deleted`. Every other terminal result is labeled `Completed`, including any retained legacy canceled row, so the Quick Find vocabulary exposes the two current user-facing Done states requested by the product contract. Open results continue to show their planning list.

### Reuse the guarded permanent-deletion authority

The UI will call `tasks_preview_permanent_deletion`, show a destructive confirmation surface containing the task title and server-calculated record count, and call `tasks_permanently_delete` only after explicit confirmation. The RPC scope will accept either a deleted task root or a present task whose lifecycle is terminal. It will continue rejecting active present tasks, unsupported root types, changed preview digests, unauthenticated calls, and mismatched idempotency requests.

Alternative considered: transition a completed task to deleted before invoking the existing RPC. That would create an observable intermediate state, a second history mutation, and unnecessary failure recovery, so the server scope is extended directly instead.

### Keep retention copy factual and quiet

Done will end with a muted footer reading `Items in Done are permanently deleted after 30 days.` The existing server contract retains work through 30 full local days and purges at the midnight beginning day 31, so no database scheduling change is required.

## Risks / Trade-offs

- [Irreversible action is exposed in ordinary UI] -> Require a server preview, a dedicated confirmation dialog, a destructive button, and stale-scope validation.
- [Completed task graphs differ from deleted hierarchies] -> Build terminal-present scope exactly like the existing automatic purge: the root task plus checklist items by `task_id`.
- [Quick Find top three can include Done work instead of active work] -> Preserve relevance-first ranking and label lifecycle clearly rather than adding an undocumented active-state ranking bias.
- [PowerSync convergence is not immediate] -> Close any open task state after successful deletion and rely on the existing synchronized source deletion, while showing pending UI and reporting failures.

## Migration Plan

1. Replace only `tasks_private.permanent_deletion_scope(uuid, text, uuid)` so it accepts retained terminal-present task roots in addition to deleted roots.
2. Preserve the public RPC signatures, grants, receipts, and client contract.
3. Apply the migration before publishing the UI that offers completed-task permanent deletion.
4. Verify deleted-root and completed-root previews, successful execution, active-root rejection, and stale-digest rejection with disposable owner-scoped fixtures.
5. Roll back by restoring the prior scope function, which disables completed-task permanent deletion while leaving deleted-root deletion and all stored data intact.

## Open Questions

None.

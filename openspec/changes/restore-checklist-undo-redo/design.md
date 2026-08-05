## Context

Checklist writes already assign one `last_operation_id` to each discrete action. The hierarchy-history trigger projects that identifier as `action_id`, and the checklist history hook collapses rows sharing that action into one undo step. The remaining defect is in the client synchronization boundary: `useTaskChecklist` currently emits an unstructured global event only after a write succeeds, while `useTaskChecklistUndo` exposes only history rows already visible through PowerSync. `TasksShell` therefore cannot know which accepted checklist operation is awaiting projection and compares stale task/checklist timestamps when routing Undo.

Task-level history already solves the corresponding race with forward-mutation reservations and `undoWhenAvailable`. The checklist path needs the same guarantee, adapted to action IDs and potentially multi-row checklist operations.

## Goals / Non-Goals

**Goals:**

- Make a successful checklist insertion, edit, completion change, deletion, clipboard action, or reorder immediately eligible for unified Undo.
- Wait for the exact accepted checklist action to appear in authoritative history before applying its inverse.
- Preserve grouped checklist operations as one undo/redo step.
- Keep task and checklist actions in one chronological history experience.
- Cover delayed PowerSync projection with deterministic hook and shell tests.

**Non-Goals:**

- Replacing authoritative database history with a client-only undo stack.
- Changing checklist persistence, history schema, or PowerSync table coverage.
- Making failed or no-op checklist mutations undoable.
- Changing task-level history semantics outside the shared routing needed to interleave checklist actions.

## Decisions

### Emit structured accepted checklist actions

`useTaskChecklist` will emit the action ID and occurrence timestamp after each successful discrete mutation. Grouped item changes already share one operation ID and timestamp, so one signal represents the complete gesture.

This keeps history ownership in the shell without threading undo callbacks through every task editor. Retaining the existing module-local event also minimizes component coupling. An unstructured event was rejected because it cannot distinguish a newly accepted action from an older projected event.

### Reserve exact action IDs until history projects

`useTaskChecklistUndo` will register accepted forward actions and expose them as pending undo work. It will remove a reservation only after projected hierarchy history contains the matching `action_id`. Undo availability will include accepted pending actions so the toolbar and keyboard command respond immediately.

This follows the task-history model while using checklist `action_id`, which is the stable grouping identity derived from `last_operation_id`. Matching only `client_mutation_id` was rejected because grouped reorder, paste, and deletion gestures create multiple row mutations under one action.

### Wait and refresh before applying an inverse

The checklist hook will provide `undoWhenAvailable` and `redoWhenAvailable`. When a pending action is newest, Undo will refresh the history projection until the exact action appears, becomes the cursor tip, and can be applied atomically, or until a bounded timeout expires. The UI will use its existing history-operation pending state during this wait.

Constructing a client-side inverse before authoritative projection was rejected because it would duplicate snapshot and conflict-guard logic and could diverge from server-accepted state.

### Route pending actions before projected timestamps

`TasksShell` will register every structured checklist action, invalidate cross-stream redo, and treat a pending checklist action as newer than already-projected task history. Once both streams are projected, existing occurrence-time comparison continues to select the newest action. Successful checklist undo records the checklist route so redo returns through the same stream.

### Preserve guarded replay and grouping

The existing checklist replay implementation remains authoritative for create/delete/restore/update/reorder inverses. The fix will continue collapsing all history rows with the same checklist action ID and will apply the group as one undo or redo operation.

## Risks / Trade-offs

- **History projection does not arrive before the timeout** -> Keep current data unchanged, clear only a still-unresolved reservation when appropriate, and report the normal history boundary instead of applying a guessed inverse.
- **Several checklist writes are accepted in rapid succession** -> Queue reservations in acceptance order and target the latest one, matching normal undo-stack semantics.
- **Task and checklist timestamps are identical** -> Prefer the explicitly pending accepted action while it is unresolved; after projection, retain deterministic event ordering and the recorded redo route.
- **A no-op reorder emits a false reservation** -> Continue returning before persistence and emit no forward-action event for unchanged order.

## Migration Plan

No database migration is required. Deploy the client changes and tests together. Rollback consists of reverting the client files; existing hierarchy history remains compatible.

## Open Questions

None.

## Context

Tasks has two interactive history engines. Task mutations reserve their server-history identity and checklist mutations reserve a hierarchy `action_id`; both then wait as long as 30 seconds for synchronized history to return before applying an inverse. `TasksShell` compares the two projected streams to choose an engine. The production hierarchy history already records complete reversible snapshots, but the client PowerSync schema omits `action_id`, so the real checklist query fails even though unit tests with mocked rows pass.

PowerSync writes are already local-first. Task mutation reservations receive the complete pre-mutation task and accepted post-mutation task. Checklist mutation hooks likewise possess the complete affected rows before and after every create, edit, completion, deletion, and reorder gesture. These boundaries can produce a device-local action journal without changing the synchronized task data model.

## Goals / Non-Goals

**Goals:**

- Make an accepted local task or checklist action immediately undoable and redoable without waiting for server-history projection or network access.
- Preserve one chronological cursor across task and checklist actions, including atomic multi-row gestures.
- Retain recent device-local history for 30 minutes across navigation and app relaunch.
- Apply inverses through existing repositories so ordinary optimistic display, validation, synchronization, server history, and conflict handling continue to operate.
- Repair and continuously validate the PowerSync hierarchy-history schema contract.
- Distinguish an empty history boundary from schema, storage, transport, and state-conflict failures.

**Non-Goals:**

- Synchronize the interactive undo cursor across devices.
- Rewrite, delete, or weaken Supabase task and hierarchy history.
- Make background/system-authored changes part of a user's local interactive history.
- Retain interactive history for longer than 30 minutes or more than 100 accepted actions.
- Introduce a third-party state-management or history dependency.

## Decisions

### Store one local action journal in PowerSync

Add a local-only `tasks_action_journal` table. Each row stores an owner, monotonic sequence, action identifier, occurrence and expiry timestamps, applied or undone state, and a versioned JSON array of semantic entity changes. A change contains an entity type, entity identifier, and complete semantic before/after snapshots; null represents creation or permanent absence.

PowerSync local-only storage is preferred over an in-memory stack because it survives navigation and ordinary app relaunch, shares the existing owner-bound database lifecycle, supports transactions and reactive queries, and adds no dependency. IndexedDB and browser-native undo were rejected because they would introduce another storage lifecycle and would not share PowerSync transaction/error semantics.

### Record at the accepted mutation boundary

Task reservations retain complete pre-mutation snapshots and commit complete post-mutation snapshots. Synchronously committed reservations from one bulk repository call are grouped under one local action. Creation registration uses a null before-state. Checklist mutation events are upgraded from an identifier-only notification to a versioned payload containing the complete affected before/after snapshots and one shared action identifier.

Pending reservations remain visible to the history coordinator. Undo invoked while a mutation is in flight waits only for that local promise to settle. A failed or no-op mutation cancels its reservation and does not create history. The journal row is written before the accepted action is exposed as traversable.

### Replay semantic snapshots through guarded repositories

Task journal snapshots use the existing `TaskHistorySnapshot` shape. Checklist snapshots contain task identity, editable fields, ordering, and recoverable deletion state while excluding revision and mutation bookkeeping.

Undo requires each current entity to semantically match the action's after-state; redo requires it to match the before-state produced by the prior undo. Replay happens in reverse entity order for undo and forward order for redo. Ordinary edits use dedicated guarded snapshot application methods. Creation, deletion, and restoration continue through optimistic hierarchy operations so complete task hierarchies remain coherent. The journal cursor changes only after every entity change succeeds.

Direct snapshot replay is preferred over waiting for a server event identifier because it is available offline and immediately. Unguarded optimistic patching was rejected because another device may have changed the entity. If current state no longer matches the expected semantic snapshot, replay stops and reports a conflict without moving the cursor.

### Keep server history as authority outside the interaction loop

Supabase history continues recording every forward, undo, and redo mutation and remains available for auditing, recovery diagnostics, and server-side conflict evidence. It no longer gates the first interactive undo or reconstructs the device-local cursor. This intentionally replaces the previous 100-step projected-history interaction contract with a maximum of 100 local actions retained for 30 minutes.

### Repair and assert local schema compatibility

Expose `action_id` in the client `tasks_hierarchy_history_events` schema and add the local journal table. At startup, execute a zero-row compatibility query against required synchronized and local history columns. A missing-column or missing-table failure is a cache-schema incompatibility, not an empty history state.

When compatibility fails, inspect the upload queue. An empty queue permits advancing the database generation and opening a fresh cache. A nonempty or unreadable queue fails closed so unsynchronized mutations are never discarded. History queries surface their errors immediately and report bounded diagnostics rather than polling a permanently invalid query.

### Make the local journal the single shell API

Replace task/checklist timestamp arbitration, cross-stream route stacks, and projection waits with one hook exposing `available`, `redoAvailable`, `pending`, reservation/registration methods, `undo`, and `redo`. Keyboard commands, pointer controls, and iOS shake all invoke that API. A new forward action atomically removes undone rows before appending the new action.

## Risks / Trade-offs

- [A mutation path omits journal registration] -> Inventory all Tasks user mutation entry points, keep registration at shared hooks/services, and add action-matrix tests covering every supported category.
- [Bulk commits are accidentally split] -> Give shared bulk calls one explicit journal action identity and verify multi-task and multi-checklist gestures with atomic replay tests.
- [Another device changes an entity after the local action] -> Compare semantic snapshots before replay, preserve the cursor, and show a specific conflict error.
- [A cache replacement would abandon pending writes] -> Require a readable zero-count upload queue before advancing generations and fail closed otherwise.
- [Local journal rows expire while the UI is open] -> Prune at startup and before every append/traversal, and derive availability only from unexpired rows.
- [A crash occurs between mutation acceptance and journal insertion] -> Insert the journal immediately at reservation commit and keep the mutation pending until insertion settles; future repository consolidation can make both writes one database transaction.
- [Server later rejects a locally accepted replay] -> Existing PowerSync conflict recovery remains authoritative; the next traversal detects semantic mismatch and reports it instead of applying another inverse.

## Migration Plan

1. Add `action_id`, `tasks_action_journal`, schema assertions, and coverage without removing server-history code.
2. On first startup, let PowerSync reconcile the declared schema; run the compatibility assertion before Tasks becomes ready.
3. If the installed cache remains incompatible, replace it only after confirming the upload queue is empty, using the existing generation mechanism.
4. Switch task and checklist mutation registration to versioned local action payloads and make the unified journal the command path.
5. Remove the obsolete projection polling, split routing, and misleading boundary fallback.
6. Validate fresh, legacy-cache, offline, relaunch, grouped-action, conflict, keyboard, pointer, and iOS-shake behavior.
7. Rollback can restore the prior hooks while leaving the additive local table and synchronized `action_id` harmlessly present. Do not roll back by deleting or resetting a cache with pending uploads.

## Open Questions

None.

## Context

Tasks already records append-only task and checklist history and exposes guarded undo and redo cursors. The current command path is fragmented, however: task and checklist history use separate cursors, editable controls can retain native browser history instead of invoking Tasks history, task-summary edits can still be waiting for their autosave timer when undo is requested, and task creation events are excluded from traversal. The visible interface also provides no direct way to distinguish an empty cursor from a broken keyboard command.

Task history is synchronized and guarded by authoritative before/after snapshots. Checklist history is also synchronized, but is owned by a separate hierarchy history stream. Both streams must remain owner-scoped and conflict-safe.

## Goals / Non-Goals

**Goals:**

- Make every documented Tasks undo and redo chord invoke application history regardless of task-field focus.
- Flush pending editor work before choosing the newest history entry.
- Merge task and checklist history chronologically at the command boundary while preserving each stream's guarded mutation logic.
- Make task creation and grouped clipboard operations traversable.
- Add temporary visible Undo and Redo controls with meaningful disabled states and diagnostics.
- Preserve redo until a new forward user action invalidates it.

**Non-Goals:**

- Replace synchronized authoritative history with browser-native input history.
- Provide permanent header placement for Undo and Redo after debugging is complete.
- Bypass conflict checks when another client has changed the same task or checklist item.
- Deploy a production database migration without separate production approval.

## Decisions

### Application history owns documented undo and redo chords

The Tasks capture-phase keyboard handler will consume documented undo and redo commands even when an input or textarea is focused, except during active IME composition. Before traversal, it will synchronously flush the open task editor's pending autosave and wait for the accepted mutation to become eligible.

Native field history was considered, but it cannot restore metadata, lifecycle, ordering, checklist, cut, paste, or cross-device changes and currently causes the command to become a no-op in the native web view.

### One command arbitrates two guarded history streams

Task and checklist hooks retain their independent authoritative cursors. The shell compares their next undo or redo timestamps and delegates to the newest eligible stream. A redo route stack preserves the corresponding stream after undo. A new forward mutation in either stream invalidates incompatible redo state.

Combining the database histories into one table was rejected because it would create a larger migration, weaken module-internal hierarchy invariants, and add no user-visible value.

### Creation uses recoverable deletion for undo

Undoing a task creation will move the created task hierarchy to the recoverable deleted state rather than physically deleting it. Redo restores the exact created snapshot. This preserves history, referential integrity, and the Done recovery model. The authoritative history trigger will recognize guarded create-undo and create-redo pairs.

Hard deletion was rejected because it would erase the source event needed for redo and could orphan related checklist data.

### Multi-record user gestures share an operation identifier

A single paste, cut, multi-delete, or multi-reorder gesture will assign one operation identifier to its accepted mutations. Undo and redo traverse every event in the operation atomically. Existing task bulk operations already use this pattern; task creation and checklist clipboard paths will adopt it.

### Temporary controls expose real cursor state

Every task-list header will render Undo and Redo before Select, Find, and Filter. Buttons are disabled only when their corresponding combined cursor is unavailable or a history move is pending. Activating an unavailable command through a keyboard shortcut still produces the existing neutral boundary toast.

## Risks / Trade-offs

- **[Risk] Pending autosave can fail while undo waits** -> Cancel the reserved traversal, preserve the cursor, and show the ordinary mutation error.
- **[Risk] Create undo conflicts with a newer synchronized edit** -> Require exact snapshot matching and reject the inverse without overwriting newer data.
- **[Risk] Two history streams can project in different orders** -> Compare authoritative timestamps only after each hook declares its candidate safe, and retain bounded pending intent by mutation identifier.
- **[Risk] Operation grouping can leave a partial group after a failed write** -> Use repository transactions or existing atomic RPCs for multi-record operations and do not expose the group as traversable until all receipts succeed.
- **[Risk] Header controls become permanent accidental chrome** -> Document them as temporary diagnostic controls and keep their implementation isolated.

## Migration Plan

1. Add local schema support for guarded task-create undo/redo and operation grouping where current history lacks it.
2. Update local repositories, hooks, keyboard handling, and list controls.
3. Validate database tests, application tests, TypeScript, lint, build, and OpenSpec.
4. Exercise keyboard and button traversal in web and native-like rendered contexts.
5. Request explicit production approval before applying any migration or publishing.

Rollback consists of reverting the web changes and migration before production publication. After production application, rollback must retain newly recorded history columns and disable their use rather than dropping history data.

## Open Questions

- The temporary header controls can be removed after native keyboard behavior and deep undo/redo sequences are proven reliable.

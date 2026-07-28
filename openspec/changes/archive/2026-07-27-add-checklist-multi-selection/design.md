## Context

The Tasks checklist editor already keeps draft rows, input focus, native handle-based drag-and-drop, optimistic persisted rows, and task-level history behavior in one module-local surface. Multi-selection must compose with those behaviors without turning checklist items into a second task-selection system or interfering with the editor's text-area-like keyboard model.

## Goals / Non-Goals

**Goals:**

- Keep checklist selection transient, drawer-local, and visually legible.
- Use the currently focused checklist input as the initial selection anchor.
- Support additive and anchored range selection, grouped native drag reordering, persistent post-drop selection, grouped deletion, and ordinary-click deselection.
- Preserve visual item order when noncontiguous selections become one contiguous group.
- Preserve the existing single-item editing, completion, draft-row, and drag interactions.

**Non-Goals:**

- A checklist bulk-action bar.
- Bulk completion or reopening.
- Cross-task checklist selection or movement.
- A custom pointer-drag implementation or custom autoscroll.
- Selecting an unsaved empty draft row as part of a persisted multi-item group.
- Database, synchronization, or schema changes.

## Decisions

### Keep selection state inside `TaskChecklistEditor`

The editor will own a selected-ID set plus an anchor ID. Selection is presentation and interaction state, not persisted task metadata, so local React state is the narrowest owner and avoids sync churn. A document-level pointer listener will clear selection for ordinary clicks outside a modified checklist-item click, which covers the rest of the drawer without adding selection props throughout the task form.

### Derive ranges and drag groups from visual order

Command-click toggles one persisted row and Shift-click replaces the selection with the contiguous visual range from the anchor. When selection begins from a focused checklist input, that focused row becomes the anchor and is included. A drag starting from a selected row derives the moving IDs from current visual order, rather than selection order, so a noncontiguous group keeps the order the user sees.

### Extend native handle drag-and-drop

The existing draggable handle remains the only drag origin. The drop calculation removes all moving rows from the visual sequence, translates the displayed insertion boundary into the remaining sequence, and then requests an optimistic grouped reorder. This retains browser-native drag behavior and existing drop indicators.

### Reuse existing checklist persistence operations

Grouped reordering and deletion will be exposed by the checklist hook as UI-level batch helpers that update optimistic state as one visible result while reusing the existing guarded per-item repository mutations. This keeps the change migration-free and preserves the established PowerSync write path.

### Treat Delete and Backspace as group deletion only while selected

When checklist multi-selection is active, either Delete or Backspace removes the selected rows and prevents the active input's normal join/delete behavior. Without checklist multi-selection, the existing text editing semantics remain unchanged.

## Risks / Trade-offs

- **Native drag events vary across browsers** -> Keep the existing draggable-handle contract and validate drag start, intermediate boundary, drop, and drag end in focused tests.
- **A global pointer listener can clear selection too early** -> Mark modified row clicks during capture and exempt a selected handle's drag-origin press so the intended selection survives long enough to drag.
- **Remote checklist updates can remove selected IDs** -> Reconcile the selected set against current persisted item IDs whenever the checklist projection changes.
- **Draft rows have no durable identity** -> Keep unsaved draft rows out of multi-selection while retaining their existing single-row drag behavior.
- **Per-item persistence is not a database transaction** -> Apply the final visual arrangement optimistically and execute repository mutations in deterministic visual order; failures retain the established per-item error/undo model rather than adding a schema-level batch protocol.

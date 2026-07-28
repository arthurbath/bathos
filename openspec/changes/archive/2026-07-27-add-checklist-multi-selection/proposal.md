## Why

Checklist editing currently supports one-item-at-a-time reordering and deletion, which makes restructuring a longer checklist unnecessarily repetitive. Checklist items need a lightweight multi-selection interaction that supports grouped reordering and deletion without introducing task-style bulk controls into the metadata drawer.

## What Changes

- Add Command-click additive selection and Shift-click anchored range selection for checklist items, using the currently focused checklist item as the initial anchor when selection begins.
- Visually distinguish selected checklist items without showing a bulk-action bar or offering bulk completion changes.
- Extend the existing native drag-and-drop path so dragging any selected item's handle moves all selected items together, preserves their visual order, and leaves them selected after drop.
- Let Delete or Backspace remove all selected checklist items as one group-selection action.
- Clear checklist multi-selection when the user makes an ordinary single click on a checklist item or elsewhere in the task drawer.
- Preserve existing native text editing, checklist checkbox behavior, and single-item drag behavior when checklist multi-selection is inactive.

## Capabilities

### New Capabilities

### Modified Capabilities

- `personal-tasks-module`: Extend editable checklist behavior with multi-selection, grouped reordering, grouped deletion, and explicit deselection semantics.

## Impact

- Tasks module checklist editor state, pointer and keyboard handlers, and native drag-and-drop ordering logic.
- Tasks checklist persistence hook if the grouped reorder or deletion path needs an atomic multi-item operation.
- Focused checklist interaction tests, full Tasks tests, TypeScript, lint, build, and rendered local validation.
- No schema, Supabase, PowerSync, MCP, cron, or production-data change is expected.

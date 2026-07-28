## Why

Checklist multi-selection currently makes the reorder handle the only drag source and clears selection as soon as an ordinary pointer press begins. This prevents the selected checklist rows themselves from supporting the familiar distinction between clicking to edit and pressing then dragging to move the selected group.

## What Changes

- Make every selected checklist row a native drag source that moves the complete selected group through the existing checklist reorder path.
- Defer ordinary-click deselection until click activation so native drag recognition can occur first.
- On an ordinary click that does not become a drag, clear checklist selection and focus the clicked checklist input for editing.
- Preserve modified-click selection, direct checkbox behavior, pointer-only handles, retained drop positions, and selected state after a successful group reorder.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine checklist multi-selection so selected row surfaces distinguish ordinary click-to-edit from native press-and-drag group reordering.

## Impact

- Tasks checklist pointer event handling and row drag attributes in `TaskChecklistEditor`.
- Checklist interaction regression tests.
- No database, Supabase, API, dependency, or cross-module changes.

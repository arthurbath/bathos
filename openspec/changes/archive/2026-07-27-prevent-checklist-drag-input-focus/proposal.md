## Why

Dragging a selected checklist row from its text input currently leaves that input focused and moves its caret, making a reorder gesture look like an editing action. Selection-mode pointer behavior needs to distinguish a completed click from a native drag before retaining text-entry focus.

## What Changes

- Remove checklist-input focus when a selected-row native drag begins.
- Preserve ordinary single-click behavior so releasing without dragging exits selection mode and focuses the clicked input for editing.
- Add regression coverage for dragging a selected checklist row from its input surface.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine selected checklist-row dragging so input-originated drags do not retain text focus or move the visible caret.

## Impact

- `src/modules/tasks/components/TaskChecklistEditor.tsx`
- Checklist editor interaction tests
- No database, synchronization, or API changes

## Why

The task selection toolbar's Edit menu currently clears selection mode when the user dismisses the menu without choosing an action. Menu dismissal is not a selection command and must leave both selection mode and the selected task set intact.

## What Changes

- Dismissing the selection-mode Edit menu by clicking outside it closes only the menu.
- The selected task set and selection toolbar remain unchanged after dismissal.
- The outside click remains consumed as a menu-dismissal interaction rather than acting on the underlying task list.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Clarify selection-mode Edit menu dismissal behavior.

## Impact

- Tasks module selection-mode pointer handling and Edit menu tests.
- No database, synchronization, API, or native-companion changes.

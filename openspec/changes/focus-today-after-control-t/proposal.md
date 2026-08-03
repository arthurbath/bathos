## Why

Control+T can change a to-do's Start planning while the Start picker remains open, but the picker's keyboard focus does not follow the newly assigned Today value. That leaves the visible provisional focus out of sync with the value the command just applied.

## What Changes

- When Control+T changes Start while that to-do's Start picker is open, move the picker's keyboard focus to the Today horizon value that Control+T assigned.
- Preserve the existing closed-picker behavior: Control+T changes Start without opening the picker.
- Add regression coverage for both open-picker and closed-picker command paths.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Keep the unified Start picker's keyboard focus synchronized with a Control+T Today-planning command without opening a closed picker.

## Impact

- Tasks module keyboard-command handling and unified Start-picker focus coordination.
- Tasks component tests for Control+T with the Start picker open and closed.
- No database, Supabase, native companion, dependency, or cross-module changes.

## Why

The current Control-based task command layout no longer matches the preferred spatial arrangement, and it lacks a keyboard command for entering task selection mode from the current task. The executable shortcuts and their help surface need to move together so the layout remains predictable.

## What Changes

- Swap the existing Control+R and Control+T task commands so R clears Start and T sets Today or cycles the Today horizon.
- Move Set Reminder from Control+B to Control+Y.
- Assign Control+B to enter task selection mode with the currently open or keyboard-highlighted task selected.
- Apply the corresponding Alt+Shift letter chords on Windows.
- Update the keyboard-command help surface and regression coverage to match the executable layout.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Revise the Control task-command layout and add targeted keyboard entry into task selection mode.

## Impact

- `src/modules/tasks/domain/taskKeyboardCommands.ts` and its unit tests
- Task shell command dispatch and task-selection state transitions
- Task keyboard-command help content and component coverage
- The durable Personal Tasks keyboard-command contract
- No database, Supabase, PowerSync, native-shell, or external API changes

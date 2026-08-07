## Why

Activating an Upcoming recurrence prototype from Quick Find currently leaves the previously focused ordinary task highlighted and only focuses the prototype row without opening its metadata drawer. Quick Find destinations need the same single-focus, open-destination behavior for recurrence prototypes that ordinary tasks already receive.

## What Changes

- Transfer whole-task keyboard focus away from any previously focused ordinary task when a recurrence-prototype result is activated.
- Navigate to the Upcoming prototype and open its ordinary metadata drawer after Quick Find activation.
- Keep the separate Edit Repeat modal closed until the user explicitly invokes it.
- Cover keyboard activation with a regression test that begins from an already focused ordinary task.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Make recurrence-prototype search destinations open with one unambiguous focus owner.

## Impact

- Tasks Quick Find destination handling in `TasksShell`.
- Upcoming recurrence-prototype focus and open state.
- Focused TasksShell regression coverage.
- No database, API, migration, dependency, or native-shell changes.

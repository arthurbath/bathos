## Why

Changing an open task's Start value to Someday can make the editor forget that its persisted checklist is present, incorrectly recombining that checklist with the remaining Add Primary Link action. The disclosure layout must remain based on the actual Primary Link and Checklist content throughout editor-local planning changes.

## What Changes

- Preserve a checklist's content-presence state while the open task is retained across Start and destination changes.
- Keep Primary Link and Checklist on separate full-width rows whenever either entity exists, including while Start is Someday.
- Preserve an open Anytime task's exact rendered Area bucket and within-bucket slot while metadata changes are being edited, including under automatic sorting, and release that placement only after the drawer closes.
- Add regression coverage for changing an open checklist-bearing task to Someday.
- Add regression coverage for Area and invisible automatic-sort metadata changes while an Anytime drawer remains open.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Clarify that established disclosure layout and rendered Anytime placement remain stable during editor-local planning changes.

## Impact

- Tasks editor disclosure-state synchronization in `src/modules/tasks/components/TasksShell.tsx`.
- Anytime Area-section placement projection in `src/modules/tasks/components/TasksShell.tsx`.
- Focused Tasks editor regression coverage in `src/modules/tasks/components/TasksShell.test.tsx`.
- No database, API, migration, dependency, or native-companion changes.

## Why

Task completion currently crosses an uncoordinated interval in which the task can leave its source list before the client knows the exact history mutation that Command-Z must traverse. Done also presents retained tasks as archive-like rows instead of ordinary recoverable task states, obscuring the direct checked-to-open and deleted-to-restored interactions.

## What Changes

- Reserve each forward task mutation before its asynchronous write or exit animation can make the task unavailable, then bind that reservation to the accepted mutation identifier so immediate undo waits for exactly that event.
- Make completion, reopening, deletion, restoration, and every other user-editable task metadata mutation participate in the same guarded 100-step undo and redo chain.
- Accept both Command-Y and Command-Shift-Z on Mac, plus their Control equivalents on Windows, as redo commands.
- Present exhausted or currently unsafe history boundaries as neutral Nothing to Undo or Nothing to Redo messages instead of destructive mutation errors.
- Present completed tasks in Done with checked task controls that reopen them when unchecked.
- Present recoverably deleted tasks in Done with a trash control in the ordinary task-control position that changes to a restore icon on hover or keyboard focus and restores the task when activated.
- Keep terminal dates as the retention timestamps and preserve the existing 31-day server-authoritative purge boundary.
- Add lifecycle, projection-delay, immediate-keyboard, redo, and Done-interaction regression coverage.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Strengthen task-history coordination and make retained Done states directly recoverable through task-native controls.

## Impact

- Tasks history hook, list data hook, task repository integration, Tasks shell, and Done row rendering
- Existing PowerSync projections for `tasks_todos` and `tasks_history_events`
- Task lifecycle/history unit, component, and database regression tests
- Durable Tasks behavior specification and human-facing Tasks guide
- No new table, column, RLS policy, publication entry, cron job, secret, or external dependency

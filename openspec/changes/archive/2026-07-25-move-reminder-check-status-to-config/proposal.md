## Why

The due-reminder claim runs automatically every minute, so a transient failure does not require immediate user intervention. Presenting a prominent warning and manual Retry action in every task list overstates a self-recovering condition, while omitting the condition entirely would make reminder diagnostics harder to inspect.

## What Changes

- Remove the reminder-check failure warning and manual Retry action from task-list views.
- Preserve the immediate, once-per-minute, and tab-visibility automatic reminder checks.
- Surface the latest in-app reminder-check condition inside Config's Synchronization Details as a live operational status.
- Keep underlying error details content-free and preserve schedules and previously claimed reminders during failures.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Replace interruptive in-list reminder-claim failure recovery with automatic retry and Config-only status visibility.

## Impact

- `src/modules/tasks/components/TasksShell.tsx`
- `src/modules/tasks/components/TaskSyncDiagnosticsDialog.tsx`
- Their focused component and hook tests
- Tasks presentation and diagnostics only; no reminder schema, RPC, Cron, Web Push, or Supabase changes.

## Why

Deleting multiple selected tasks currently waits for each persistence request before beginning the next one, so tasks disappear from the list piecemeal. The interaction should acknowledge the user's single bulk action immediately while preserving recoverability when persistence fails.

## What Changes

- Begin every selected task deletion together and remove the full selected group from the active list in one optimistic render.
- Retain the existing per-task authoritative deletion path while grouping the selected deletions into one undoable operation.
- Wait for every persistence result, keep successful deletions removed, and restore only tasks whose deletion failed.
- Present one concise failure notification and emit one privacy-safe console and Sentry diagnostic when any selected deletion fails.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Bulk recoverable deletion becomes an immediate grouped optimistic interaction with selective rollback and privacy-safe failure reporting.

## Impact

- Tasks selection-mode deletion orchestration in the React shell.
- Existing optimistic task-list projection and guarded history operation grouping.
- Tasks runtime diagnostics and Sentry reporting.
- Focused Tasks shell, task-list, and reporting tests. No database, Supabase, PowerSync, Edge Function, or native companion change is required.

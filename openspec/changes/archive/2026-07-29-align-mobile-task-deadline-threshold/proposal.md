## Why

Compact task-row Deadline copy currently keeps using signed day counts at every distance, while the wider presentation switches distant deadlines to a legible short calendar date. Mobile users should receive the same nine-day threshold in both future and overdue directions.

## What Changes

- Keep relative Deadline copy only when the deadline is within nine calendar days of the owner-local planning date.
- Render deadlines ten or more days away, or ten or more days overdue, as a short month-and-day label on both compact and wider task rows.
- Add boundary coverage for nearby and distant compact Deadline formatting.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine concise task-row Deadline presentation so compact and wider layouts share the same inclusive nine-day relative window.

## Impact

- Tasks date-formatting helpers and their unit tests.
- Task-row rendering tests for compact Deadline metadata.
- No database, Supabase, API, dependency, or cross-module changes.

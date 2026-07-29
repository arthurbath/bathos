## Why

The Anytime view already communicates each task's Area through its visible Area bucket. Repeating the same Area in every task's secondary metadata line adds noise without adding context.

## What Changes

- Suppress Area metadata from collapsed task rows on the Anytime view.
- Preserve Area metadata on other task views where it is not already conveyed by the containing bucket.
- Preserve all other secondary-row metadata and Area-based Anytime grouping.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Clarify that Anytime Area buckets replace redundant per-row Area metadata.

## Impact

- Tasks module row rendering in `src/modules/tasks/components/TasksShell.tsx`.
- Focused Tasks component tests.
- No database, API, synchronization, native-app, or migration impact.

## Why

The native macOS Tasks app can remain open continuously, but its shared web runtime currently performs planning-date transactions every minute and polls an empty PowerSync upload queue every second. Most of that work cannot change state and needlessly wakes the WebView and local SQLite runtime during long sessions.

## What Changes

- Run task planning-date activation at startup and only when the planning calendar date advances.
- Recheck the planning date when the native app becomes active so a session that slept through midnight catches up immediately.
- Deduplicate overlapping planning activations and upload-queue reads.
- Poll PowerSync's upload queue quickly while uploads are pending and at a lower idle frequency when it is empty.
- Continue refreshing queue depth immediately when PowerSync reports a status change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Reduce nonproductive background work without weakening midnight activation or synchronization feedback.
- `tasks-macos-companion`: Keep long-running native Tasks sessions responsive and resource-conscious.

## Impact

- Tasks runtime scheduling and focused unit tests.
- No database, API, synchronization schema, native binary, or user-visible workflow changes.

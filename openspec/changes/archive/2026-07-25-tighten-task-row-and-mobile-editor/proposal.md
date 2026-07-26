## Why

The newly compact task rows can become calmer and use slightly less horizontal space without sacrificing clarity or mobile tapability. The expanded editor also has enough width on supported mobile viewports to keep related temporal and identity controls paired rather than stacking them.

## What Changes

- Render task titles at normal weight in active, Done, and Trash task rows.
- Reduce the visible and hover footprint of task source-link and ellipsis controls, keeping them vertically centered and mobile-operable.
- Keep Start and Deadline in two equal columns at mobile viewport widths.
- Keep Actionability and Organization in two equal columns at mobile viewport widths.
- Normalize the Deadline trigger to the same text size as the other task-editor inputs on mobile.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refines compact task-row typography and controls and changes the expanded editor's mobile field-pair layout.

## Impact

- Tasks row rendering, source indicator sizing, expanded-editor grid classes, and Tasks component tests.
- No database, API, Supabase, synchronization, reminder, routing, or cross-module behavior changes.

## Why

The current Tasks lists do not yet express several planning and reading behaviors expected from daily use. Today ordering is trapped within its existing horizon, Upcoming ignores future deadlines without a future start date, undo can surface an unsafe-traversal failure for an apparently current action, and expanded notes remain a fixed plain-text field.

## What Changes

- Allow a Today to-do to be dragged before or after a to-do in another currently visible Today horizon, updating both its day horizon and its order while keeping empty horizon headings hidden.
- Preserve Anytime membership for open work whose start date is absent, today, or earlier.
- Derive an Upcoming controlling date from the future start date first, otherwise from a future deadline, then group the next seven days by day, the following 12 months by month, and later work by year.
- Move Today-horizon indicators before Anytime and Upcoming titles, render them in semantic Today yellow, replace the action-like Next arrow with a neutral list-position icon, and use the Inbox icon for the Inbox horizon.
- Use square controls for task completion and circular controls for bulk selection.
- Quickly collapse and fade a completed or canceled to-do before it leaves the active list while respecting reduced-motion preferences and restoring the row if the mutation fails.
- Make the projected undo cursor tolerate projection ordering without presenting a stale event as safely undoable, and keep database snapshot enforcement authoritative.
- Replace the fixed notes textarea with a full-height Markdown-aware notes surface that supports inline code, emphasis, lists, and clickable safe links while retaining plain-text editing and storage.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine Today reordering, Anytime and Upcoming derivation, list-row semantics, terminal motion, undo safety, and expanded Markdown notes.

## Impact

- Tasks domain, list hooks, row and editor components, presentation utilities, tests, and human documentation.
- The existing `tasks_todos` and `tasks_history_events` synchronization contract and a narrowly scoped Supabase migration if database-side history validation needs correction.
- The existing React Markdown dependency plus a small CommonMark extension dependency if bare-link parsing cannot be implemented safely with the current parser.
- No cross-module imports, new task tables, public database privileges, tags, or changes to the PowerSync publication boundary.

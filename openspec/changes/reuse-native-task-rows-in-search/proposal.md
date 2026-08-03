## Why

The full Tasks search page currently renders a reduced, generic result row, so search loses the native list presentation, metadata, lifecycle affordances, and per-task action menus that users rely on elsewhere. Search should reuse the canonical row implementations so later list-row changes automatically remain consistent without recreating behavior in a second surface.

## What Changes

- Render each ordinary search result with the canonical task row configured for the task's natural list context: Anytime, Upcoming, Someday, or Done.
- Render recurrence-definition results with the canonical Upcoming recurrence-prototype row, including its native metadata and action menu.
- Preserve per-task controls and lifecycle-appropriate ellipsis actions from the natural list while keeping search non-reorderable and outside bulk-selection mode.
- Add keyboard traversal from the search input through results and back, with Return navigating to and opening or focusing the result in its natural list.
- Disable Tasks Control-key commands on the full Search page so search remains a navigation and discovery surface rather than a mixed-list mutation context.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Define canonical native-list presentation and per-row behavior for full Search results, plus the Search page's keyboard and interaction boundaries.

## Impact

- Tasks search result composition and ranking in `src/modules/tasks/components/TaskQuickFind.tsx`.
- Canonical task and recurrence row configuration in `src/modules/tasks/components/TasksShell.tsx` and `TaskRecurrencePrototypeRow.tsx`.
- Tasks component tests covering native list parity, recurrence results, menus, keyboard traversal, and prohibited Search interactions.
- No database, Supabase, native-companion, API, or dependency changes.

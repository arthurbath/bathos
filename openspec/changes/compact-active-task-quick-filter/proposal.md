## Why

An active Tasks quick filter currently expands its list-toolbar button with the filter name, which can force the list actions onto another line at mobile widths. The active state needs a compact, stable treatment that still makes the changed list membership explicit.

## What Changes

- Keep the Quick Filters trigger icon-sized whether the list is filtered or unfiltered.
- Reuse the Select Tasks active-button treatment to indicate that a quick filter is active.
- Show the active quick-filter name directly beneath the current list title.
- Preserve the existing Quick Filters menu, accessible naming, persistence, and filtering behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Change the visible placement and active-state presentation of an applied Tasks quick filter.

## Impact

- Tasks list toolbar and heading markup in `src/modules/tasks/components/TasksShell.tsx`.
- Tasks shell regression coverage for quick-filter presentation and list navigation.
- No database, API, persistence, or native companion changes.

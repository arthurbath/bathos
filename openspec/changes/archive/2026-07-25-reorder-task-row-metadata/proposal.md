## Why

Collapsed task summaries currently combine hierarchy into one label, surface Start redundantly, and order the remaining metadata inconsistently with the intended reading hierarchy. A stable, omission-friendly order will make dense task rows easier to scan without repeating information already communicated by list grouping.

## What Changes

- Present task Area and Project as separate optional metadata items, with Area before Project.
- Follow hierarchy with Reminder, Deadline, and non-actionable Actionability metadata in that order.
- Omit each missing metadata item without leaving a placeholder or gap.
- Remove Start and Today horizon metadata from collapsed task summaries, including Upcoming rows whose buckets already communicate Start.
- Preserve existing responsive compression, semantic colors, icons, and assistive labels for the metadata that remains.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Define the canonical collapsed task-row metadata order and omit Start from task summaries.

## Impact

- Tasks module only.
- Updates `TasksShell` task-row presentation and its integrated tests.
- Updates the durable personal Tasks specification.
- No database, API, persistence, routing, or dependency changes.

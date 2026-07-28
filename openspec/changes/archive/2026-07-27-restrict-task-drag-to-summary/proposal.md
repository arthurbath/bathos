## Why

An open task currently exposes its entire metadata editor as a task-level drag surface, which conflicts with interactive fields and nested draggable checklist items. Task reordering needs a single, predictable handle that also makes enough room for the surrounding list during the drag.

## What Changes

- Limit task-level drag initiation to the task summary row.
- Prevent task-level dragging from any part of the expanded metadata editor.
- Collapse an open task's metadata editor when a task drag begins from its summary row.
- Preserve existing single-task and multi-task reorder behavior after the drag starts.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine pointer task reordering so only the summary row initiates a task drag and an open editor collapses at drag start.

## Impact

- Tasks module only.
- `TaskRow` drag ownership, open-editor lifecycle, and focused drag regression tests.
- No database, Supabase, PowerSync, MCP, or dependency changes.

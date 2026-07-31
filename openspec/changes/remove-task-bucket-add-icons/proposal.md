## Why

Creatable task-bucket headings currently repeat a small Plus icon that adds visual noise without adding functionality. The heading itself is already the complete activation target, so the interaction can remain discoverable through use without permanently displaying an extra glyph.

## What Changes

- Remove the visible Plus icon from creatable bucket headings across Tasks lists.
- Preserve the pointer cursor, accessible heading button semantics, and existing click-to-create behavior.
- Preserve the bucket-specific metadata applied to tasks created from each heading.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Creatable bucket headings remain actionable without persistently rendering a Plus icon.

## Impact

- Affects task-list bucket headings in `src/modules/tasks/components/TasksShell.tsx` and their focused regression coverage.
- Does not change task creation, routing, metadata, Supabase objects, native companions, or dependencies.

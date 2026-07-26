## Why

Opening a task currently reveals the editor in two visually distinct stages because the editor's top inset appears as the disclosure reaches its final height. Removing that unnecessary inset will make the expansion read as one fluid motion and tighten the metadata drawer.

## What Changes

- Remove the extra top padding from the expanded task editor form.
- Preserve the existing horizontal and bottom inset.
- Require opening and closing to appear as one continuous disclosure animation when reduced motion is not requested.
- Add regression coverage for the revised editor spacing.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine the inline editor disclosure contract so its content has no delayed top inset and expands as one continuous motion.

## Impact

- Tasks module only.
- Updates the expanded editor layout in `src/modules/tasks/components/TasksShell.tsx`.
- Updates Tasks shell regression coverage and the durable personal Tasks specification.
- No database, Supabase, PowerSync, API, or deployment configuration changes.

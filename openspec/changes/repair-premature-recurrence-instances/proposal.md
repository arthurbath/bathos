## Why

The template-free recurrence conversion preserved future adopted projections as ordinary tasks, and the repeat editor continued evaluating recurrence far into the future. Together these behaviors expose ordinary instances before their prototypes reach the applicable spawn date and advance the virtual prototype prematurely.

## What Changes

- Convert a future ordinary task into a virtual recurrence prototype without retaining an ordinary occurrence before the first spawn date.
- Keep an ordinary adopted instance only when the recurrence begins on the owner's current planning date.
- Reject recurrence evaluation beyond the owner's current planning date and stop the repeat editor from requesting future evaluation.
- Repair the owner's 54 premature adopted future projections by preserving their latest editable content in the prototype snapshot, rewinding each prototype to the projected spawn date, and removing the premature task and occurrence rows.
- Preserve reached instances, including instances deferred into the future after their scheduled date.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Tighten recurrence integrity so prototypes cannot materialize ordinary work before the owner-local spawn date and future projection cleanup preserves prototype content without deleting reached instances.

## Impact

- Supabase recurrence creation and evaluation RPCs, one fail-closed data repair migration, and recurrence pgTAP coverage.
- Tasks recurrence dialog and service response parsing.
- Production recurrence definitions, revisions, occurrences, tasks, checklist items, and owner-scoped validation fixtures.

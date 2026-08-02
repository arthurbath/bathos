## Why

Pointer completion and keyboard completion currently share successor-focus behavior even though they express different intent. A pointer user should not see an unrelated task gain keyboard focus after clicking a closed task's checkbox, while a keyboard user needs continuous focus to keep working through the list.

## What Changes

- Distinguish pointer-originated completion from keyboard-command completion for closed tasks.
- Leave no task with whole-task keyboard focus after pointer completion.
- Continue moving whole-task keyboard focus to the next eligible task after keyboard completion.
- Add regression coverage for both interaction origins.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Define origin-sensitive focus behavior when a closed task is completed.

## Impact

- Tasks module completion event handling and focus restoration in `TasksShell` and task rows.
- Tasks shell interaction tests and the durable personal Tasks behavior contract.
- No database, Supabase, native companion, or API changes.

## Why

Tasks can announce that a to-do moved to another list while the to-do is still visibly open and retained in the current view. This is especially reproducible after a new-task draft has persisted, because the open editor and the stored task temporarily use different identifiers.

## What Changes

- Treat every task represented by the currently open metadata drawer as editor-owned, including a persisted new-task draft whose stored identifier differs from the drawer's synthetic draft identifier.
- Defer movement and quick-filter departure notices until the editor closes and the task actually leaves the rendered view.
- Preserve immediate departure feedback for successful metadata changes to tasks that are not open.
- Add interaction coverage for a Start change that moves an existing task and a quick-filter change that hides a persisted draft.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Clarify that the metadata departure notice lifecycle applies to every task owned by an open drawer, including persisted creation drafts.

## Impact

- Tasks module shell metadata-mutation and editor-close coordination.
- Tasks interaction tests for existing task editors and persisted creation drafts.
- No database, Supabase, API, native-companion, or dependency changes.

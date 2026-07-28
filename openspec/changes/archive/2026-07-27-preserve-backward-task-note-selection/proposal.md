## Why

Line-aware Markdown redecoration currently restores every Notes selection as a forward range. During an upward pointer drag, that reverses the browser's anchor and moving edge and prevents the user from continuing to select text backward.

## What Changes

- Preserve whether a task-note selection is forward or backward whenever Markdown presentation is rebuilt.
- Restore both source offsets and selection direction after caret-line or selection-line presentation changes.
- Add regression coverage for backward cross-line selections.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Clarify that line-aware Markdown redecoration preserves forward and backward text selection.

## Impact

This is a focused Tasks UI correction in `TaskMarkdownNotes` and its component tests. It changes no database schema, Supabase behavior, sync contract, dependency, or other BathOS module.

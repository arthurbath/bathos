## Why

The task Notes editor currently collapses the caret at the second pointer location instead of extending the existing text selection when the user Shift-clicks. Shift-click range selection is a standard text-editing interaction and should work without sacrificing the editor's line-aware Markdown presentation.

## What Changes

- Extend an active task-note selection from its existing anchor to a Shift-clicked source position.
- Preserve forward and backward source offsets while crossed Markdown lines switch from semantic preview to editable source presentation.
- Keep Shift-click selection distinct from link activation and ordinary drag selection.
- Add focused automated coverage and rendered interaction verification for the gesture.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Make Shift-click an explicit supported selection gesture in the directly editable Markdown Notes surface.

## Impact

- Tasks module only.
- `TaskMarkdownNotes` pointer and selection handling plus its focused tests.
- No database, Supabase, routing, dependency, or cross-module changes.

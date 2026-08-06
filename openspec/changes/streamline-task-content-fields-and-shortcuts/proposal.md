## Why

Optional task content is currently presented inconsistently: Notes is always visible, Link and Checklist use separate disclosure patterns, and keyboard users cannot jump directly to those fields. A unified disclosure row and field-specific focus commands will make the drawer denser, more predictable, and faster to operate without a pointer.

## What Changes

- Add Control+H on Mac and Alt+Shift+H on Windows to open a single target task, reveal Link when needed, and focus its end or toggle from the end to the beginning.
- Add Control+N on Mac and Alt+Shift+N on Windows with the same behavior for Notes.
- Refine Control+C on Mac and Alt+Shift+C on Windows so an existing empty insertion item above completed checklist items toggles the next blank item to the checklist top, while the ordinary command retains the established insertion slot.
- Make Notes optional in the expanded drawer, alongside Link and Checklist.
- Present every absent optional content type in one stable bottom action row using evenly distributed primary-outline buttons labeled `+ Notes`, `+ Link`, and `+ Checklist`.
- Remove an optional field from the disclosure row when it is revealed, and restore its action on the next drawer opening when the committed field remains empty.
- Use `Link` rather than `Primary Link` in user-facing task-editor language while preserving the underlying data model and external-link behavior.
- Reduce drawer bottom padding when no optional-content actions remain and Checklist is the final drawer content.
- Update the keyboard-shortcut reference and regression coverage for the new commands and drawer lifecycle.

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `personal-tasks-module`: Changes task-editor optional-content disclosure, field-focus commands, checklist insertion focus behavior, keyboard-reference labels, and drawer spacing.

## Impact

- Affects the Tasks module task row/editor, checklist editor coordination, keyboard-command dispatch, keyboard help, and component tests.
- Updates the existing `personal-tasks-module` behavior contract.
- Does not change the Tasks database schema, task data model, Supabase RPCs, or native wrapper code.

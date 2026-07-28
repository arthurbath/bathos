## Why

Checklist rows are separate inputs, but their keyboard behavior should feel like adjacent lines in one text editor. The current editor can append a blank row, but it does not yet provide complete caret-preserving line creation and joining, reliable shortcut focus, or pointer-only reorder controls for empty rows.

## What Changes

- Make Return create a blank checklist row immediately below the current row and move editing focus into it.
- Make boundary Backspace and forward Delete join adjacent checklist rows while preserving the expected caret position.
- Keep Command+A native to the active checklist input.
- Show a reorder handle for a newly created empty row, while removing reorder handles from the tab order.
- Remove the redundant Add Checklist Item button after a checklist exists.
- Make the checklist shortcut focus the final unchecked item, or create a new empty item when no unchecked item exists.
- Use the existing compact input styling when available without creating a new shared input variant.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Expand checklist editing into a textarea-like, fully keyboard-operable sequence of independently reorderable inputs.

## Impact

- Tasks checklist editor component and its focused regression tests.
- Existing Tasks checklist command routing and durable Tasks behavior specification.
- No Supabase schema, PowerSync table set, or external API changes.

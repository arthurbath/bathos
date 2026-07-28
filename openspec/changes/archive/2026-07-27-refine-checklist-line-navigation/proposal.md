## Why

Checklist inputs are intended to feel like lines in one keyboard-editable text surface, but Return currently discards the caret boundary when creating the next item, vertical arrows remain trapped inside one single-line input, and insertion motion produces distracting layout jumps. Refining these interactions completes the textarea-like model while keeping each checklist item independently actionable.

## What Changes

- Split a checklist item's text at the caret when Return creates the item below.
- Move Up Arrow and Down Arrow focus between adjacent checklist inputs, placing the caret at the destination value's end.
- Leave vertical arrows native at the first and last checklist boundaries.
- Remove checklist insertion and deletion motion while preserving the existing completion-reorder animation.
- Extend regression and rendered interaction coverage for split, focus, boundary, and motion behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refines checklist Return, vertical-arrow navigation, and insertion/deletion presentation behavior.

## Impact

- Tasks checklist editing UI and focused tests.
- Durable personal Tasks behavior specification.
- No database, Supabase, PowerSync, API, or dependency changes.

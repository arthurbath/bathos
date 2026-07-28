## Why

Checklist items intentionally behave like separate lines in one keyboard-editable text surface, but horizontal caret movement currently stops at each input boundary. Extending boundary traversal makes keyboard editing continuous across adjacent checklist items without disturbing native cursor movement inside an item.

## What Changes

- Move Left Arrow from the beginning of a checklist item to the end of the preceding checklist item.
- Move Right Arrow from the end of a checklist item to the beginning of the following checklist item.
- Preserve native horizontal movement away from item boundaries and keep the outer checklist boundaries inert.
- Cover persisted and unsaved checklist rows with focused regression and rendered interaction checks.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Extend checklist keyboard editing with horizontal caret traversal between adjacent checklist inputs.

## Impact

- Tasks checklist editor keyboard handling and focused tests.
- The durable personal Tasks behavior specification.
- No database, API, Supabase, PowerSync, or dependency changes.

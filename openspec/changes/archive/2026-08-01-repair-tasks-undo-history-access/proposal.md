## Why

The Tasks client currently disables all task undo and redo whenever any synchronized history row uses valid vocabulary that the client parser does not recognize. Recent widget mutations and retained pre-template-removal snapshots trigger this failure, leaving the entire authoritative cursor inaccessible even after new user actions.

## What Changes

- Make task-history decoding compatible with every currently valid mutation channel and with retained legacy snapshot vocabulary that remains in append-only history.
- Prevent a historical compatibility problem from silently presenting as an empty history cursor.
- Surface content-free diagnostics when history reconstruction encounters incompatible data.
- Add regression coverage proving that recent valid user actions remain undoable and redoable when retained history contains widget and legacy template records.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Clarify that append-only history remains traversable across supported vocabulary evolution and that incompatible history is diagnosed instead of silently masquerading as an empty cursor.

## Impact

- Tasks history parsing and cursor reconstruction in `src/modules/tasks/domain/` and `src/modules/tasks/hooks/`
- Shared Tasks mutation-channel vocabulary in `src/modules/tasks/types/tasks.ts`
- Tasks unit and rendered interaction tests
- No database schema, RLS, PowerSync table-count, or production-data change

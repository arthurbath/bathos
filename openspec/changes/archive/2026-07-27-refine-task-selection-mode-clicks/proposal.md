## Why

Selection mode currently treats an unmodified click anywhere on a task row as a selection toggle, which prevents the ordinary row-opening interaction and makes it too easy to change a bulk selection accidentally. Selection intent should remain explicit through a modified row click or the dedicated selection circle.

## What Changes

- Preserve Command-click and Shift-click on task rows as explicit selection gestures.
- Let the selection-mode circle toggle one task with an ordinary click.
- Make an ordinary click on the rest of a task row leave selection mode and open that task.
- Cover the pointer distinctions with focused interaction tests and rendered verification.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine task-list pointer behavior so selection toggling and ordinary task opening remain distinct while selection mode is active.

## Impact

- Affects task-row click dispatch and task selection state in `src/modules/tasks/`.
- Adds no database, Supabase, PowerSync, MCP, routing, or dependency changes.
- Preserves keyboard selection behavior and existing modified-click selection semantics.

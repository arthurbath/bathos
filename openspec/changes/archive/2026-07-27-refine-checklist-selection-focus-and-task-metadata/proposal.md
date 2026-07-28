## Why

Checklist multi-selection currently leaves a text input focused, which visually and behaviorally conflicts with the user's group-selection intent. Task summary rows also omit the existence of checklist work, making tasks with checklist items harder to recognize without opening them.

## What Changes

- Blur checklist text inputs when modified-click selection begins so typing cannot edit an item while group selection is active.
- Keep checklist selection keyboard handling authoritative until selection is cleared.
- Show the canonized checklist icon in a task summary row whenever the task has at least one checklist item.
- Place the checklist indicator immediately before actionability in second-row task metadata.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine checklist multi-selection focus behavior and task-row checklist metadata presentation.

## Impact

- Affects the Tasks checklist editor, task-list metadata derivation and rendering, focused component tests, and durable Tasks specifications.
- Uses existing checklist data and Lucide iconography.
- Requires no database migration, API change, new dependency, or production data rewrite.

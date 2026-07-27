## Why

Tasks can select multiple task rows but disables pointer reordering as soon as multi-selection begins. Bulk drag reordering should let a user move an arbitrary visible selection as one deliberate action while preserving visible-bucket meaning, automatic-sort constraints, and the expectation that one gesture is one undoable change.

## What Changes

- Allow a drag initiated from any selected task to move the complete multi-selection on Today, Upcoming, Anytime, and Someday.
- Preserve the selected tasks' current visual order, regardless of selection order, and compact eligible tasks at the requested visual drop boundary.
- Apply visible-bucket metadata when a selection crosses Today horizons, Upcoming date sections, or Anytime and Someday Area regions.
- In automatically sorted Anytime and Someday, project each selected invisible-sort subgroup to the requested boundary when legal and otherwise clamp it to the nearest legal position without changing Deadline, horizon, or Actionability.
- Keep successfully moved tasks selected so the group can be moved again.
- Preserve native browser drag cancellation: commit only from an in-app drop, never from drag end, and clear transient drag state when Escape reaches BathOS.
- Persist every multi-task drop atomically and traverse the complete gesture as one undo or redo action.
- Limit the first implementation to Today, Upcoming, Anytime, and Someday without introducing custom pointer dragging, custom scrolling, or keyboard reordering.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Extend task selection, pointer reordering, visible-bucket projection, automatic peer ordering, reminders, and undo or redo semantics to multi-task drag groups.

## Impact

- Tasks shell selection and native drag state, drop indicators, visible section rendering, and post-drop focus.
- Automatic-order and task-order domain helpers.
- Task-list hooks and the local-first Tasks repository, including transactional ordered batch mutation and grouped history.
- Tasks history schema and generated Supabase or PowerSync types if an operation-grouping field or context is required.
- Focused domain, repository, hook, component, migration, undo or redo, and rendered interaction tests.
- No new dependency, custom drag framework, custom scrolling system, route, or Tasks table publication entity.

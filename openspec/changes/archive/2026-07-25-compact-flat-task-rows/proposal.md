## Why

Tasks should show more work at once, especially on mobile, without sacrificing the clear association between each task's title and metadata. The selected flat-row direction provides that density while preserving strong interaction feedback only when a task is focused, selected, or open.

## What Changes

- Replace the 56-pixel bordered task cards with uniform 44-pixel collapsed rows that have no resting border, background, radius, or inter-row gap.
- Preserve compact title and metadata alignment without increasing row height when secondary details are present.
- Give focused and selected tasks the same quiet background highlight instead of outlining keyboard focus.
- Give expanded tasks a quiet background and rounded containment so the editor remains visibly associated with its summary row.
- Apply the task-row treatment consistently to active, Done, and Trash task lists while leaving planning-project cards unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Changes the durable density and interaction-state presentation requirements for task rows.

## Impact

- Tasks module list-row styling and shared task-list layout constants.
- Active, Done, and Trash task-row renderers.
- Tasks module component tests and visual browser verification.
- No database, API, Supabase, PowerSync, routing, or cross-module behavior changes.

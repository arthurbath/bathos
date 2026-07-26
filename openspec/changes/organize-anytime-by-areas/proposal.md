## Why

Areas already provide a durable hierarchy for ongoing responsibilities, but the primary planning experience does not yet use them to organize the Anytime pool. Making Areas visible and directly manipulable in Anytime gives loose tasks and project tasks a legible home without changing the freely intermingled Today workflow.

## What Changes

- Rename the Projects management destination and its user-facing navigation language to Areas & Projects while preserving its existing route.
- Keep Today grouped only by Inbox, Now, Next, and Later, with Area and Project names presented as secondary task metadata.
- Divide Anytime into an unlabelled No Area region followed by one task bucket per Area that has visible tasks.
- Order Area buckets by the Areas & Projects page's existing manual Area order.
- Group a Project task under its Project's Area without adding a competing direct Area assignment.
- Let pointer drag reorder tasks within an Anytime Area bucket and move tasks between Area buckets or the unlabelled No Area region.
- Treat a cross-Area drop as an explicit structural move: assign the target Area or no Area, clear an incompatible Project assignment, and preserve the task's planning state.
- Let an Anytime Area bucket heading create a task directly in that Area while the floating New Task action continues creating unassigned work at the top.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Define Area naming, Today metadata, Anytime grouping, effective Area membership, contextual creation, manual Area-bucket order, and cross-bucket drag behavior.

## Impact

- Tasks list derivation and rendering in `TasksShell`.
- Task creation placement, drag-and-drop organization updates, manual planning order, optimistic updates, and undo history.
- Areas & Projects navigation labels, page copy, breadcrumbs, human documentation, and focused tests.
- Existing `tasks_areas.order_key`, `tasks_todos.order_key`, `tasks_todos.area_id`, `tasks_todos.project_id`, and `tasks_todos.hierarchy_order_key` fields are sufficient. No Supabase migration, PowerSync publication change, or new dependency is required.

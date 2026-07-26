## Why

Anytime and Someday currently preserve one fully manual order inside each Area, even when urgent, current, or actionable work would benefit from a predictable default hierarchy. One optional synchronized preference can provide that structure while retaining manual control among tasks that share the same automatic sort attributes.

## What Changes

- Add one Config toggle, off by default, that enables automatic sorting for both Anytime and Someday and remains consistent across sessions and devices.
- Sort tasks independently inside the unassigned region and each effective Area by Deadline, Today horizon, Actionability, and then manual peer order.
- Place the oldest overdue Deadline first, followed by later overdue dates, Today, future dates, and tasks without a Deadline.
- Order Today horizons as Inbox, Now, Next, Later, and no horizon; order Actionability as Ready, Rechecking, then Waiting.
- Restrict manual pointer reordering in automatic mode to tasks with the same Deadline, horizon, and Actionability while preserving cross-Area movement.
- Keep the insertion indicator at the last legal peer position over invalid rows and move it to the canonical legal position when entering another Area.
- Retain open and newly created tasks in place until close, then apply the automatic projection with the established pause and movement animation.
- When automatic sorting is disabled, materialize the currently visible automatic order as the new fully manual order.
- Present Rechecking before Waiting in Actionability selection controls.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Add a durable automatic-list-sorting preference, deterministic Anytime and Someday ordering, constrained peer reordering, cross-Area drag projection, close-time reconciliation, and Actionability menu parity.

## Impact

- Tasks Config, list derivation, Area sections, drag-and-drop placement, optimistic task ordering, and Actionability controls.
- `tasks_user_settings`, generated Supabase types, PowerSync schema, sync connector, portability, and repository preference access.
- One additive Supabase migration that initializes automatic sorting to off without rewriting task records.
- Focused domain, repository, hook, component, sync, portability, migration, rendered browser, and performance coverage.
- No new table, PowerSync publication entity, route, dependency, or production deployment in this implementation pass.

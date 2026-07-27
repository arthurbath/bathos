## Context

Tasks currently supports native HTML drag-and-drop for one task at a time. Entering multi-selection disables dragging, and the drop model carries one dragged task identifier plus one target row. Today and Upcoming expose visible planning buckets. Anytime and Someday can expose visible Area buckets, while optional automatic sorting further constrains each Area to invisible Deadline, horizon, and Actionability peer groups.

A bulk drop therefore has two distinct responsibilities: interpret one visible pointer boundary for an arbitrary visual selection, and persist all resulting order and metadata changes as one durable user operation. The existing history model records one event per changed task and exposes one event per undo step, so operation grouping must become explicit without weakening the existing per-task safety checks.

The implementation must preserve native browser dragging and scrolling. It must also coexist with the active whole-task focus, Area organization, automatic sorting, and Upcoming ordering changes already present in the working tree.

## Goals / Non-Goals

**Goals:**

- Drag every selected task when the gesture begins on any selected row.
- Preserve the selected tasks' current visual order.
- Interpret the pointer as one desired visible boundary after conceptually removing the selected rows.
- Apply visible-bucket metadata to every selected task when the drop crosses a Today horizon, Upcoming date, or Area boundary.
- Respect automatic invisible-sort peer groups without changing Deadline, horizon, or Actionability merely to satisfy a pointer location.
- Commit the full drop in one local transaction and expose it as one undo or redo operation.
- Keep the moved group selected after a successful drop.
- Preserve a mutation-free native cancellation path.

**Non-Goals:**

- A custom pointer drag framework, custom auto-scrolling, drag previews, or keyboard reordering.
- Cross-list dragging through navigation.
- Bulk drag support in Done, project detail, Area detail, search results, or other list surfaces in this change.
- Making invisible automatic-sort groups visible.
- Changing the automatic-sort tuple or visible bucket definitions.

## Decisions

### Use a pure bulk-drop projection before persistence

The shell will pass the visible task sequence, selected identifiers, source view, desired target boundary, visible bucket target, and automatic-sort state to a pure domain planner. The planner will return per-task patches and the final materialized visual sequence.

The planner first removes all selected rows from the visible sequence. Selection order is ignored. The selected rows are taken from the current rendered order, which becomes the authoritative order within the moved group.

For manual-order views, the complete selected group is inserted contiguously at the desired boundary. For automatically sorted Anytime and Someday, selected tasks are partitioned by their post-drop invisible tuple. Each subgroup is inserted at the desired boundary when that boundary is inside its legal peer interval, or clamped to the closest legal boundary otherwise. This allows a mixed selection to scatter into multiple legal invisible groups while preserving visual order inside each subgroup.

Alternative considered: restrict a selection to one invisible peer group. This was rejected because it would arbitrarily prevent useful mixed selections and make visible Area moves inconsistent.

### Visible buckets apply metadata, invisible buckets do not

A cross-horizon Today drop sets every selected task to the target Today horizon. A cross-date Upcoming drop sets every selected task's Start to the target future date and clears its Today horizon. A cross-Area Anytime or Someday drop applies the established exact-container rule separately to each selected task: crossing into a new Area assigns that Area directly and clears Project, crossing to the unassigned region clears both, and a task already effectively in the target Area retains its Project.

Same-bucket drops preserve planning and container metadata. Automatic invisible groups constrain placement only. They never cause Deadline, horizon, or Actionability mutation.

Alternative considered: coerce every selected task to the invisible tuple under the pointer. This was rejected because drag position must not silently rewrite task meaning.

### Materialize the complete affected order in one repository operation

The hook will optimistically apply the planner result and call one repository method with an ordered list of task patches. The repository will load and validate all tasks before writing, calculate stable order keys for the complete affected sequence, and update all changed tasks inside one PowerSync write transaction.

Every changed task keeps its own unique client mutation identifier, as required by the current history uniqueness constraint. All task updates produced by the drop also share a new operation identifier. This separates task-level conflict identity from gesture-level history identity.

Alternative considered: call the existing single-task reorder method repeatedly. This was rejected because a partial failure could persist only part of the gesture and each task would become a separate undo step.

### Add explicit operation grouping to task history

The Tasks schema will add a non-null `last_operation_id` to `tasks_todos` and a non-null `operation_id` to `tasks_history_events`, both with generated UUID defaults. Existing rows receive generated operation identities without firing the task-revision trigger. Existing history rows therefore remain independent one-event operations. Write triggers fall back to each task's client mutation identity when an older or restored payload omits operation identity.

The history trigger will copy `last_operation_id` into `operation_id`, falling back to the task's client mutation identifier for writers that do not yet send an operation identifier. Ordinary repository mutations will use their unique mutation identifier as the operation identifier. Bulk drops will assign one shared operation identifier to every changed task.

Undo and redo will group contiguous history events by operation identifier, verify every source event against its current task, and apply every inverse in one transaction. The generated inverse events share a new operation identifier while retaining each task's `undo_source_event_id`. A grouped undo or redo is accepted only when every task is safe, so no partial history traversal is possible.

Alternative considered: infer grouping from timestamps or `affected_ids`. This was rejected because timestamps are not a durable identity and current `affected_ids` is per-event.

### Keep native cancellation semantics

Mutation occurs only from an accepted in-app `drop` event with a valid projected boundary. `dragend` only clears transient UI state. If BathOS receives Escape during a drag, it clears the pending projection and the task selection. If the browser consumes Escape or the pointer is released outside an accepted drop surface, no repository call occurs.

This guarantees a mutation-free cancellation path without replacing native drag behavior. It does not guarantee that every browser will deliver Escape to the application.

### Keep selection after a successful drop

The existing selected identifiers remain selected after persistence. The open task, if any, closes when the interaction becomes multi-selection, consistent with the existing selection contract. A failed or canceled drop does not change task data.

## Risks / Trade-offs

- [PowerSync projects the task rows before grouped history events arrive] -> Reserve all selected forward mutations and wait for the complete operation projection before allowing immediate undo.
- [A schema rollout temporarily mixes writers with and without operation identifiers] -> The database trigger falls back to each client mutation identifier, preserving safe single-event history for older writers.
- [Multiple selected invisible tuples cannot all occupy the exact pointer boundary] -> Clamp each tuple subgroup independently and preserve subgroup visual order.
- [Native HTML drag events vary across Safari and Chrome] -> Commit only on accepted in-app drop, keep dragend mutation-free, and cover the state machine with component tests plus rendered browser checks.
- [Rewriting several order keys increases sync traffic] -> Restrict writes to tasks whose metadata or materialized order key changes and keep the operation transactional.
- [Grouped history touches export and recovery formats] -> Add the operation fields as backward-compatible export data, preserve historical defaults, and extend portability tests.

## Migration Plan

1. Add `tasks_todos.last_operation_id` as non-null with a generated UUID default so PostgreSQL safely initializes existing rows without issuing task updates.
2. Add `tasks_history_events.operation_id` the same way and index owner plus operation.
3. Update the history trigger so new events always receive an operation identifier and older writers remain compatible.
4. Update generated Supabase types and the PowerSync schema. The publication remains exactly the same set of Tasks tables.
5. Publish the web code only after the production migration is applied.
6. Run an owner-scoped fixture proving one multi-task drop creates one history operation and that grouped undo and redo restore all rows atomically.

Rollback of application code is compatible with the additive schema. Database rollback is not required. The added columns and index can remain unused by older code.

## Open Questions

None. The interaction, cancellation boundary, invisible-group projection, post-drop selection, and history semantics were resolved before implementation.

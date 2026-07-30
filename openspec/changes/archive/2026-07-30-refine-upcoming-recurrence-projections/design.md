## Context

Calendar recurrence evaluation currently materializes future `tasks_todos` rows so they can participate in the synchronized Upcoming projection. The web UI consequently receives a task-shaped row even when that row represents cadence-governed future work. After-completion definitions instead appear in a separate waiting section while their current occurrence remains outstanding.

The recurrence database already separates definitions, immutable revisions, and occurrences. This change must preserve that separation, keep reached instances behaving like normal tasks, and reconcile materialized future projections when a cadence changes.

## Goals / Non-Goals

**Goals:**

- Make cadence-governed Upcoming projections visually and behaviorally distinct from ordinary task instances.
- Edit all supported recurrence fields through one authenticated, revision-checked mutation.
- Give waiting after-completion recurrences direct access to their outstanding instance.
- Allow the next after-completion occurrence date to be overridden by a new revision.
- Supersede and replace materialized future calendar projections without rewriting reached instances or immutable occurrence provenance.

**Non-Goals:**

- Replacing the existing materialized occurrence model.
- Rewriting reached task instances when a recurrence changes.
- Adding drag reordering or bulk task actions to recurrence projections.
- Adding recurrence editing to reached instances in Today or Anytime.

## Decisions

### Identify an Upcoming projection from recurrence provenance

An open task shown in Upcoming with a non-null recurrence definition is treated as a recurrence projection. The same persisted row becomes an ordinary task instance once its Start makes it eligible for Today/Anytime. This uses existing provenance and avoids a second synchronized projection table.

Alternative considered: add a separate projection record type. That would duplicate scheduling data and expand PowerSync scope without improving the current workflow.

### Edit through a single revisioned RPC

A new authenticated `tasks_edit_recurrence` function wraps the existing revision-checked save boundary and writes the rich cadence fields to the newly inserted revision in the same transaction. It follows the existing idempotency, ownership, and conflict contracts and grants execution only to authenticated users.

Alternative considered: call the existing save RPC and update rich fields from the client. Revision rows are immutable outside their authoritative context, and a two-step write would expose partially applied cadence state.

### Use the edited Start as an after-completion next-occurrence override

For after-completion recurrences, the edit dialog labels the schedule date as Next Occurrence. When the outstanding occurrence belongs to an older recurrence revision, completion uses the current revision's Start as the next date. Later completions under that same revision return to interval-from-completion scheduling.

Alternative considered: add a separate override column. The revision Start already represents the scheduling anchor and the source-revision comparison provides an unambiguous one-time boundary.

### Keep projections out of ordinary task interaction scopes

Upcoming recurrence projections render the recurrence icon instead of a completion control and are excluded from selection-mode targets, task metadata shortcuts, direct opening, and drag reorder. Their row and menu open Edit Repeat. Waiting after-completion definitions use a compact two-line row with menu actions for Edit Repeat and Go to Instance only when their outstanding occurrence is not already represented in a dated Upcoming bucket.

### Supersede materialized future projections

Calendar edits mark open future task rows from prior revisions as superseded, reset the definition's evaluation cursor to the owner-local planning date, and evaluate the new revision through the normal bounded horizon. Superseded rows and their immutable occurrence provenance remain durable, while task lists, search, Area details, and native widget snapshots exclude them. Reached instances are not superseded.

Alternative considered: delete or mutate occurrence records. Occurrences are append-only recurrence evidence, and deleting them would erase the exact provenance that revisioned recurrence is designed to preserve.

## Risks / Trade-offs

- [A prior-revision projection remains synchronized after it is superseded] → Every user-visible task query filters the explicit supersession marker while retaining the row for provenance.
- [The next-occurrence override depends on revision provenance] → Database tests cover edited and unedited after-completion advancement.
- [A waiting definition can lose its outstanding instance between render and navigation] → Resolve the synchronized root id at activation time and leave the user on Upcoming if unavailable.
- [Existing recurrence clients know only the basic save RPC] → Add a new RPC rather than changing an existing function signature.

## Migration Plan

1. Add the authenticated edit RPC, future-projection supersession marker, and adjusted after-completion advancement without rewriting recurrence provenance.
2. Deploy the backward-compatible web client and updated generated function typing.
3. Roll back by restoring the previous trigger function and dropping the new RPC. Existing recurrence revisions and occurrences remain valid.

## Open Questions

None.

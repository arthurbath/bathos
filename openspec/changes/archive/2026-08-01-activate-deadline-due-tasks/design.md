## Context

Upcoming already treats a future deadline as the controlling date when an open Anytime to-do has no future Start. Today, however, only tasks with a reached explicit Start are materialized into Today Inbox. At the owner-local midnight, a deadline-only task therefore stops qualifying for Upcoming without gaining Today membership.

BathOS stores a future Start in `start_date`, but represents active Today planning with `start_date = NULL` plus a `today_section`. This change must respect that canonical representation rather than persisting today's calendar date as a Start value.

Both the local SQLite repository and `tasks_private.activate_due_roots` perform temporal activation. They must use the same eligibility and precedence rules so offline launches, connected clients, and scheduled server activation converge.

## Goals / Non-Goals

**Goals:**

- Promote deadline-only work into Today Inbox when its deadline reaches or precedes the owner-local planning date.
- Keep the Start control visibly unset before activation.
- Preserve explicit Start precedence over deadline-driven activation.
- Keep activation idempotent, revisioned, and recoverable after missed daily checks.

**Non-Goals:**

- Changing deadline validation or presentation.
- Converting future deadlines into stored future Starts.
- Changing recurrence prototype scheduling, reminder resolution, or PowerSync table membership.

## Decisions

### Use the deadline as an activation trigger, not stored Start metadata

The activation query will include an open, present, Anytime task when either its explicit Start has reached the planning date or it has no Start, no Today horizon, and a deadline that has reached the planning date. The mutation remains the canonical Today transition: clear `start_date` and assign `today_section = 'inbox'` while retaining the deadline.

Persisting the future deadline into `start_date` was rejected because it would expose a Start the user did not set and duplicate the existing Upcoming fallback projection.

### Give explicit Start absolute precedence

Deadline activation requires `start_date IS NULL`. A future explicit Start therefore continues to control planning even when the deadline is today or overdue. This matches the existing rule that Start and Deadline may coexist in either order.

### Catch up overdue deadline-only work

Eligibility uses `deadline <= planning_date`, not equality. A client or server that missed one or more midnight evaluations will still surface the work on its next run. Once the task receives Today Inbox, the deadline-only predicate no longer matches, preserving idempotence.

### Preserve the existing ordering transition

Eligible tasks are processed by their controlling date, then `order_key`, then ID. Newly activated deadline-only work receives the same Today Inbox tail ordering and revision semantics as reached explicit Starts.

## Risks / Trade-offs

- **A future explicit Start may leave an already-overdue task outside Today** -> This is intentional because an explicit Start is the user's stronger planning instruction and existing contracts permit Start after Deadline.
- **Multiple clients may activate the same task concurrently** -> Existing revision checks, terminal-state predicates, and idempotent eligibility converge after the first accepted transition.
- **Existing overdue deadline-only work may enter Today immediately after rollout** -> This is the desired catch-up behavior and rewrites only eligible open work through the normal revision path.

## Migration Plan

1. Extend and test the local repository activation query.
2. Add a forward-only migration replacing `tasks_private.activate_due_roots` with matching eligibility.
3. Run focused TypeScript and pgTAP coverage, then full applicable validation.
4. Deploy the migration before or with the matching web/native release. The function replacement can be rolled back by restoring the prior function definition; task transitions already accepted remain ordinary Today planning revisions.

## Open Questions

None.

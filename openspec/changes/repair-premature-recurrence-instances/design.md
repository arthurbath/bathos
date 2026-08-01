## Context

The template-free migration distinguished generated future projections from adopted occurrences and removed only the generated projection. Imported Things recurrences used adopted occurrences for all source tasks, including 54 dates that had not yet been reached, so those rows remained ordinary tasks and advanced their definitions beyond the first spawn date. Separately, the repeat dialog requested four future recurrence evaluations after every save, while the authoritative RPC accepted arbitrary future through-dates.

The owner also has reached recurrence instances that were later deferred. Those are ordinary tasks and must remain intact even when their current Start is in the future.

## Goals / Non-Goals

**Goals:**

- Make the owner-local planning date the authoritative upper bound for recurrence generation.
- Represent an unreached newly configured task only through the virtual prototype.
- Preserve the current editable content of each premature adopted projection in its recurrence revision before removing the task.
- Distinguish cleanup candidates by occurrence scheduled date, not by the task's current editable Start.
- Make the production repair fail closed against the exact audited owner-scoped shape.

**Non-Goals:**

- Reinterpret reached, completed, trashed, restored, or deferred instances.
- Change recurrence cadence evaluation or prototype rendering.
- Change the PowerSync publication or add tables.

## Decisions

### Bound generation to the owner-local planning date

`tasks_evaluate_recurrence` will reject a through-date later than the date derived from `tasks_user_settings.planning_timezone`. This creates an authoritative boundary even if a client regresses. The repeat dialog will stop pre-evaluating future dates and will evaluate only the current planning date when the configured first date is due.

Clamping was considered, but rejection makes erroneous callers observable rather than silently accepting a request with different semantics.

### Adopt only a reached source task

`tasks_create_recurrence_from_task` will compare the schedule date with the same owner-local planning date. A schedule on the planning date adopts the source task as the reached initial instance. A future schedule snapshots the source task, creates the definition and revision with that date as `next_occurrence_date`, removes the source checklist and task rows, and returns a nullable occurrence.

Keeping a hidden task row was considered, but the template-free model already defines prototypes as revision snapshots rather than tasks and the prior migration removed generated projections physically.

### Repair by scheduled date and preserve current content

The repair candidate is an open, present, adopted occurrence whose immutable `scheduled_date` is later than the owner's planning date. This excludes a reached instance subsequently deferred through its editable Start. Before deletion, the migration writes a normalized snapshot of the current task and checklist into the occurrence's recurrence revision, rewinds `next_occurrence_date` to `scheduled_date`, and resets `evaluated_through_date` to the planning date.

The migration will assert the exact audited population before mutation and assert the expected post-state afterward.

## Risks / Trade-offs

- **Risk:** A premature projection contains edits made after import. **Mitigation:** Snapshot its current task and checklist into the prototype revision before deletion.
- **Risk:** A reached instance deferred into the future is mistaken for a projection. **Mitigation:** Classify only by immutable occurrence `scheduled_date > planning_date`, never editable task Start.
- **Risk:** A future client again requests future generation. **Mitigation:** Reject it in the SECURITY DEFINER RPC and cover the boundary with pgTAP.
- **Risk:** Production data drifts before deployment. **Mitigation:** Use exact owner-scoped preflight assertions and abort the transaction on any mismatch.

## Migration Plan

1. Refresh and verify a private production backup.
2. Apply the fail-closed migration after confirming 60 definitions, 54 future adopted open projections, zero future generated projections, and the expected owner planning date.
3. Verify 54 premature task and occurrence rows are gone, each affected definition points to its former scheduled date, and reached/deferred occurrences remain.
4. Run owner-scoped recurrence acceptance fixtures for pre-date, spawn-date, advancement, and reached-instance preservation, then clean them up.
5. Verify PowerSync remains at exactly 17 approved Tasks tables, cron and advisors remain healthy, publish the matching web release, and verify rendered production behavior.

Rollback uses the refreshed private backup because the migration intentionally removes rows after preserving their current content in prototype snapshots.

## Open Questions

None.

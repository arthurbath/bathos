## Context

The recurrence model stores scheduling behavior in the immutable current revision and ordinary prototype content in a normalized JSON snapshot. Historical migrations also placed `start_offset_days` and `deadline_offset_days` inside that snapshot. Those redundant snapshot fields have drifted from the accepted recurrence revision: the affected production rules specify six days earlier while their snapshots specify either one day earlier or no Start.

The recurrence editor and Upcoming projection use the revision-level Deadline offset, so they preview the intended Monday Start and Sunday Deadline. `tasks_private.instantiate_recurrence_occurrence`, however, currently derives generated dates from the snapshot fields, producing Saturday or null Starts.

## Goals / Non-Goals

**Goals:**

- Give preview, activation, and generated task persistence one scheduling authority.
- Correct every future spawn without rewriting existing ordinary instances.
- Cover both observed stale-snapshot shapes with database regression tests.
- Preserve all prototype content inheritance and recurrence idempotency behavior.

**Non-Goals:**

- Repair already generated task instances.
- Rewrite recurrence definitions or historical revisions.
- Change recurrence cadence, missed-occurrence policy, UI, or public RPC signatures.
- Remove legacy snapshot keys in this change.

## Decisions

### Derive generated dates from the current recurrence revision

`tasks_private.instantiate_recurrence_occurrence` will derive dates from `_revision.deadline_offset_days`:

- When the revision has no Deadline offset, the cadence date is the generated Start and Deadline is null.
- When the revision has a nonnegative Deadline offset, the cadence date is the generated Deadline and Start is the cadence date minus that offset.

This reuses the established `tasks_private.recurrence_spawn_date` helper and matches the recurrence editor preview and activation boundary.

**Alternative considered:** Normalize or backfill all snapshot scheduling offsets. This would repair redundant data but leaves two authorities capable of drifting again and unnecessarily mutates user recurrence history.

### Treat snapshot scheduling offsets as legacy, non-authoritative data

The snapshot remains authoritative for inherited ordinary metadata, including summary, notes, link, Area, actionability, checklist content, and reminder configuration. Its scheduling-offset keys will be ignored by instance generation. They remain stored for backward compatibility until a separately scoped schema simplification removes them.

**Alternative considered:** Reject spawning whenever the snapshot and revision disagree. That would prevent wrong dates but would also strand valid recurrence work instead of safely applying the accepted schedule.

### Deploy as a function replacement with adversarial pgTAP coverage

The migration replaces only the private instance-construction function. Tests will deliberately combine a six-day revision offset with both a stale `-1` snapshot offset and a null snapshot offset, then prove both instances receive the revision-derived Start and Deadline.

The function remains `SECURITY DEFINER`, retains its empty `search_path`, and remains executable only by its existing internal callers. No new grants are introduced.

## Risks / Trade-offs

- **Risk: A hidden client still expects snapshot offsets to control dates** -> The preview, activation calculation, and durable specification already use the revision rule; regression tests establish that contract explicitly.
- **Risk: Replacing a large PL/pgSQL function could introduce an unrelated difference** -> Copy the current production function verbatim and change only the two date assignments, then run the complete Tasks recurrence pgTAP suite.
- **Trade-off: Redundant stale keys remain in stored snapshots** -> They become harmless for spawning. Removing them requires a separate compatibility review and is not necessary for this repair.

## Migration Plan

1. Add regression fixtures that fail against the current implementation.
2. Create a timestamped Supabase migration replacing the private instance function.
3. Apply and test locally, including the full recurrence database suite and strict OpenSpec validation.
4. Run a read-only production preflight confirming the expected function definition and migration state before deployment.
5. Apply the migration to production only with explicit deployment approval, then read back the function definition and verify no existing task rows were mutated by the migration.

Rollback consists of restoring the prior function body. No table data rollback is required because the migration changes no stored rows.

## Open Questions

None. The live production mismatch and intended schedule semantics are both confirmed.

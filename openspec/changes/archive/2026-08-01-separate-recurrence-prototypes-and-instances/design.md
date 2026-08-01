## Context

BathOS stores recurrence definitions, immutable revisions, logical occurrences, and materialized task rows separately. Materialized rows retain recurrence provenance so the system can enforce idempotency and trace their source. The current web projection incorrectly treats the mere presence of that provenance as proof that a row is the recurrence prototype. As a result, reached instances can receive the prototype repeat symbol and lose ordinary task controls.

Calendar evaluation currently materializes occurrences only through the requested planning date. After-completion evaluation materializes a future successor immediately when the current occurrence is completed. This supplies a usable future schedule row, but it does not yet handle trash as a terminal event or retract the successor when the latest instance is restored.

## Goals / Non-Goals

**Goals:**

- Derive prototype presentation from authoritative occurrence timing, not lineage alone.
- Keep one future calendar projection available so the prototype remains visible in Upcoming after the current instance is reached.
- Let every reached or manually rescheduled spawned instance behave as an ordinary task.
- Advance after-completion recurrence after either completion or trash.
- Return an after-completion definition to waiting when its latest terminal instance is restored before its successor is reached.
- Keep projection identity consistent across Upcoming, Quick Find, and native widgets.
- Preserve existing tables, occurrence uniqueness, and PowerSync publication scope.

**Non-Goals:**

- Replacing the existing recurrence tables with a new prototype table.
- Allowing the future prototype row to be completed, dragged, bulk-edited, or edited as an ordinary task.
- Changing recurrence cadence authoring, reminder inheritance, end conditions, or existing instance metadata editing.
- Rewriting reached historical instances or deleting immutable occurrence records.

## Decisions

### Define a prototype as an active, not-yet-reached occurrence

A task row is treated as the recurrence prototype only when its linked logical occurrence is active, not superseded, and scheduled after the owner's current planning date. Recurrence lineage by itself identifies an instance's source, not its current UI role.

This retains the current immutable occurrence model and avoids adding a mutable role flag that could drift from the schedule. A dedicated prototype table was rejected because the definition and future occurrence already contain the necessary identity and adding a table would expand PowerSync and restore contracts.

### Keep one calendar occurrence materialized ahead

Calendar evaluation will continue generating due occurrences according to the existing missed-event policy, then materialize the first valid cadence date after the evaluation date as the next protected projection. That future row occupies the proper Upcoming bucket. When its date is reached, the same row becomes an ordinary task instance and evaluation creates the following future projection.

The future row is an implementation of the permanent recurrence prototype, not an independently editable task before its spawn date. Deterministic logical keys keep repeated evaluation idempotent.

### Derive after-completion state from the latest instance

An after-completion definition with an open latest instance has no dated successor and appears once in the waiting section. Completion or trash uses the authoritative terminal timestamp in the definition's planning time zone to materialize one future successor. The future successor is the dated prototype until it reaches its schedule.

If the latest terminal instance is restored before that successor is reached, the successor is marked superseded and omitted from task surfaces. The restored instance again becomes the outstanding instance and the definition returns to waiting. Immutable occurrence history remains intact.

### Centralize web projection identity

The recurrence hook will expose task identifiers for genuine future projections using the occurrence schedule. TasksShell and Quick Find will consume that identity instead of checking `recurrence_definition_id`. Native widget projection receives the same authoritative scheduled-date information through its local PowerSync query.

This prevents separate surfaces from reintroducing the lineage/prototype conflation.

## Risks / Trade-offs

- **A materialized future row exists before its user-visible spawn date** -> All task surfaces classify it by authoritative occurrence schedule and expose only prototype controls until that date.
- **Restoring after a successor has already reached could create an ambiguous chain** -> Restoration only retracts an un-reached successor whose predecessor is the restored latest instance. Once a successor has reached, it remains the latest instance and earlier history does not rewind the chain.
- **Calendar rules with an end boundary may have no next projection** -> The definition remains durable, but no Upcoming prototype is shown after the final permitted occurrence.
- **Client clocks could disagree about reach status** -> Projection classification uses the owner's canonical planning date and the occurrence's calendar date, matching existing list routing.
- **Existing generated future rows may already exist** -> The migration is additive and idempotent. Existing occurrence rows remain valid and are reclassified by date without rewriting task content.

## Migration Plan

1. Replace recurrence evaluation so calendar rules materialize due work plus at most one next future projection.
2. Replace the after-completion trigger so completion and trash advance the cadence and restoration retracts an un-reached successor.
3. Add focused pgTAP coverage for one-ahead calendar projection, ordinary reached instances, trash advancement, and restoration.
4. Deploy the web classification change after the database migration. The old client remains backward-compatible because new rows use the existing schema.
5. Roll back by restoring the prior functions. Created occurrences remain immutable and idempotent, so rollback does not require deleting data.

## Open Questions

None.

## Why

Repeating Tasks can preview the correct generated Start and Deadline while the authoritative spawn path creates a different Start or no Start at all. The preview reads the current recurrence rule, but spawning currently permits stale scheduling offsets embedded in the prototype metadata snapshot to override that rule.

## What Changes

- Make the current recurrence revision's Deadline offset the sole authority for generated instance dates.
- Derive a generated instance's Start as the cadence Deadline minus the configured number of days earlier.
- Generate no Deadline only when the current recurrence revision has no Deadline rule.
- Ignore missing or stale Start and Deadline offsets in prototype metadata snapshots when spawning instances.
- Add database regression coverage for both observed corrupt states: a stale one-day Start offset and a missing Start offset.
- Leave already generated ordinary task instances unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Clarify that the accepted recurrence revision, not redundant prototype snapshot scheduling fields, controls the Start and Deadline assigned to every generated instance.

## Impact

- **Tasks module:** Repeating-task instance generation only; no ordinary task editing or display changes.
- **Supabase objects:** `tasks_private.instantiate_recurrence_occurrence` and database recurrence regression tests.
- **Blast radius:** Future calendar and after-completion recurrence spawns that assign Start or Deadline dates. Existing generated tasks, checklists, recurrence definitions, and user-authored task metadata are not rewritten.
- **Dependencies:** No new dependencies or public API signature changes.

## Why

The current Tasks recurrence implementation conflates recurrence prototypes with both reusable templates and materialized future task rows. That makes deferred spawned instances disappear behind prototype treatment and introduces a Templates surface that is unrelated to the intended recurrence model.

## What Changes

- **BREAKING** Remove the Tasks Templates view, navigation, routes, services, sync tables, portability collections, template provenance, and all existing template records.
- Make each recurrence definition and its current revision the sole authoritative prototype, including an immutable snapshot of the task content used to spawn future instances.
- Render recurrence prototypes only in Upcoming: calendar prototypes appear in their next-spawn date bucket, while after-completion prototypes waiting on an open instance appear in the Repeating Tasks section.
- Generate ordinary, fully editable to-dos from prototype snapshots when recurrence dates are reached. Editing, deferring, completing, trashing, or restoring an instance never rewrites prototype content.
- Track spawned instances only for recurrence timing and identity. A deferred reached instance remains an ordinary visible task, while the prototype independently advances or waits according to its recurrence rule.
- Convert existing template-backed recurrence definitions and genuine future projection rows into first-class prototype snapshots without deleting reached ordinary instances.
- Preserve after-completion behavior: the prototype waits on its current instance, schedules from that instance's terminal date, and returns to waiting if that same instance is restored before its successor is reached.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Remove reusable task templates and redefine recurrence prototypes, spawned instances, Upcoming presentation, editing, evaluation, restoration, and migration behavior.

## Impact

- Tasks React routes, navigation, Upcoming rendering, quick find, repeat editing, portability, types, tests, and PowerSync schema.
- Supabase Tasks recurrence definitions, revisions, occurrences, template tables, provenance columns, RPCs, triggers, constraints, RLS policies, publication membership, generated client types, and database tests.
- Existing template data is intentionally removed. Existing recurrence content is migrated into recurrence revisions, genuine future projection task rows are removed, and reached spawned task rows remain ordinary tasks.
- PowerSync's approved Tasks table set decreases from 20 to 17 because the three template tables are removed and no replacement table is introduced.

## Why

An installation that reconnects from a stale local task snapshot can run system-authored rollover or reached-date maintenance before downsync catches up. If the authoritative task has since changed or disappeared, replaying or indefinitely retaining that stale maintenance can overwrite newer planning state or block every later queued mutation.

## What Changes

- Distinguish system-authored task-maintenance PATCH conflicts from user-authored offline edits.
- Treat an authoritative revision change or missing authoritative task as superseding a stale system-authored maintenance PATCH, record a content-free receipt, and let the queue continue.
- Preserve the existing durable rebase and retry policy for user-authored task edits, completions, scheduling, ordering, and lifecycle changes.
- Add regression coverage for stale rollover batches containing changed and removed recurrence instances.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine deterministic task reconciliation so stale system-authored maintenance yields to newer or missing authoritative state without weakening offline user-intent preservation.

## Impact

- Tasks synchronization connector and focused connector tests.
- The personal Tasks module only. No database migration, PowerSync topology change, Supabase object, dependency, native source, or task-content diagnostic is added.

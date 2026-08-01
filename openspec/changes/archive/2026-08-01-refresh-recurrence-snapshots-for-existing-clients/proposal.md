## Why

Existing PowerSync clients that cached recurrence revision rows before the prototype snapshot column existed can retain a null local value even though production now stores a valid snapshot. Those clients reject every recurrence prototype and hide repeating work until the affected rows are emitted again.

## What Changes

- Re-emit every existing recurrence revision through PostgreSQL logical replication without changing its stored values.
- Verify the refresh is owner-scoped, preserves every recurrence snapshot byte-for-byte, and leaves the synchronized Tasks table boundary unchanged.
- Add regression coverage for the value-preserving refresh and confirm an already-open production client receives valid prototype snapshots.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Production synchronization must backfill newly synchronized fields into already-cached rows without requiring the user to clear local data.

## Impact

- Supabase migration and recurrence revision immutability context.
- PowerSync logical replication for the existing `tasks_recurrence_revisions` table.
- Tasks database regression tests and production acceptance.

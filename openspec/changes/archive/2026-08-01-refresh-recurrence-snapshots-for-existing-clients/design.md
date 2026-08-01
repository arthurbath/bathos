## Context

The template-removal migration added `prototype_snapshot` and populated all 62 production recurrence revisions before the matching client schema was published. Fresh PowerSync databases receive the populated field, but previously initialized databases retained null for the newly added local column and the strict client parser correctly rejected those incomplete rows.

## Goals / Non-Goals

**Goals:**

- Cause logical replication to emit every existing recurrence revision after clients understand `prototype_snapshot`.
- Preserve every business value, revision number, timestamp, and snapshot exactly.
- Keep recurrence revisions immutable outside the bounded migration context.

**Non-Goals:**

- Change recurrence schedules, instances, task content, or PowerSync topology.
- Relax client snapshot validation.
- Require local database deletion or sign-out.

## Decisions

The migration enters the existing private recurrence mutation context for each affected owner and performs a no-value-change update of `prototype_snapshot`. PostgreSQL still emits an update through logical replication, allowing PowerSync to hydrate the field in existing local rows. The migration records exact before/after row counts and hashes in temporary tables and aborts unless both are unchanged.

The client parser remains strict. Treating a missing prototype as valid would conceal a broken synchronized projection and could create recurrence instances from incomplete metadata.

## Risks / Trade-offs

- The migration writes a new physical tuple for each recurrence revision. The bounded production set is small, and the identical-value/hash assertions prevent semantic rewrites.
- A disconnected client receives the refresh on its next synchronization, which is the intended PowerSync behavior.

## Migration Plan

1. Refresh and verify the private production backup.
2. Prove the exact recurrence revision count and snapshot hash before deployment.
3. Apply the value-preserving refresh migration.
4. Confirm the same count and hash, exact 17-table PowerSync boundary, and hydrated rendering in an existing client.

## Open Questions

None.

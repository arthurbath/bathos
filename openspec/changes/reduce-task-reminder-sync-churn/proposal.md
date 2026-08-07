## Why

Visible Tasks clients currently write and synchronize one reminder-claim receipt and one delivery-target heartbeat every minute even when no reminder is due. More than 99% of the resulting production claims contain no reminder, creating unbounded operational-table growth and avoidable PowerSync traffic without improving reminder delivery.

## What Changes

- Make empty in-app reminder checks read-only: return an empty result without retaining a claim receipt or refreshing the surface target.
- Retain idempotency receipts only for claims that actually lease at least one reminder and purge those receipts after an explicit 24-hour retry window.
- Stop publishing, projecting, or granting the PowerSync replication role access to the server-only claim-receipt table.
- Preserve the existing visible-client reminder cadence, surface isolation, retry lease, acknowledgement behavior, and cross-surface fallback after Web Push acceptance.
- Add deployment verification for the bounded receipt lifecycle and the reduced 16-table PowerSync publication.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Bound in-app reminder claim receipts, make empty checks write-free, and remove server-only claim receipts from the synchronized Tasks topology.

## Impact

- Tasks reminder claim RPC and pgTAP coverage.
- Supabase `tasks_reminder_claims` retention and scheduled cleanup.
- PowerSync client schema, owner stream, publication, replication-role grants, and topology verification.
- No user-facing reminder behavior, task content, or already-created reminder delivery records change.

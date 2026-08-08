## Context

The Tasks runtime owns two periodic checks while a connected client is open. A one-minute timer invokes two local planning transactions even when the planning date is unchanged. A one-second timer reads PowerSync queue statistics even when there are no uploads. PowerSync already emits status changes that can prompt an immediate queue refresh.

## Goals / Non-Goals

**Goals:**

- Preserve activation at startup and promptly after crossing midnight.
- Preserve near-immediate pending-upload feedback while writes are queued.
- Prevent overlapping periodic work.
- Reduce idle wakeups for long-running native and web clients.

**Non-Goals:**

- Change synchronization topology or server scheduling.
- Change task activation semantics.
- Claim a fixed memory ceiling for WebKit.

## Decisions

### Gate planning work by the resolved planning date

The runtime still checks the current planning date once per minute, but it invokes repository transactions only when that date differs from the last successfully activated date. A failed activation is not recorded and is retried on the next check.

### Use adaptive queue polling

Queue statistics are read every second while uploads remain queued and every fifteen seconds while idle. PowerSync status changes continue to trigger an immediate deduplicated read, so the idle interval does not delay normal synchronization feedback.

### Deduplicate in-flight reads and activations

Each operation shares its current promise. Timer, lifecycle, and status events therefore cannot create overlapping database work.

## Risks / Trade-offs

- If PowerSync fails to emit a status change when a new upload is enqueued, the idle state can take up to fifteen seconds to discover it. Normal task writes still synchronize independently, and after discovery the display returns to one-second polling.
- WebKit may still retain memory after transient peaks. This change removes avoidable steady-state work rather than imposing process-level memory management.

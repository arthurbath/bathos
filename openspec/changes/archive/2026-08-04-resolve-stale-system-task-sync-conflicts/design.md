## Context

Tasks starts from its durable local PowerSync projection so installed clients remain useful offline. Owner-local planning maintenance can therefore run before a reconnecting installation has received a fresh downsync. The existing conflict hardening rebases every field-level task PATCH, which is correct for user intent but unsafe for derived system maintenance: a stale rollover can overwrite newer server planning, and a removed recurrence instance produces a permanent missing-task retry that blocks the transaction behind it.

Production acceptance found one Safari partition with a two-entry maintenance transaction followed by a twenty-entry maintenance transaction. The first transaction had one already-applied row and one recurrence instance absent from the authoritative server. Every queued patch was explicitly marked `last_actor_type = system`; user completions in the native Mac partition omitted that marker and remain ordinary durable user intent.

## Goals / Non-Goals

**Goals:**

- Let newer or missing authoritative state supersede stale system-authored task-maintenance PATCHes.
- Drain mixed maintenance transactions without replaying stale rollover fields onto newer server revisions.
- Preserve the existing rebase, stable mutation identity, bounded retry, and missing-task retention policy for user-authored task PATCHes.
- Keep diagnostics content-free and make the supersession visible as a conflict receipt.

**Non-Goals:**

- Change when local rollover or reached-date activation runs.
- Discard user-authored offline edits, completions, scheduling, ordering, or lifecycle changes.
- Add a database migration, synchronization table, server endpoint, native implementation, or dependency.
- Directly edit a production PowerSync database or delete queued rows outside the supported connector path.

## Decisions

- Treat only an explicit `last_actor_type = system` on the queued PATCH as system maintenance. Missing or unknown actor metadata follows the conservative user-intent path and remains durable.
- Attempt the original optimistic update normally. If its base revision is current, the system maintenance is valid and uploads once.
- On the first authoritative revision conflict, including a missing task, do not rebase system maintenance. Return a distinct superseded outcome, record `system_mutation_superseded` with the available remote revision, and allow the enclosing PowerSync transaction to complete.
- Keep the existing immediate rebase loop unchanged for non-system PATCHes. This avoids weakening offline user guarantees and lets current user completions continue retrying through transient transport errors.
- Use a distinct internal outcome rather than labeling supersession as already applied or as a remote rejection. This keeps connector control flow and diagnostics truthful.

## Risks / Trade-offs

- [A genuine system-authored maintenance write loses a race] -> The authoritative newer revision wins; the next normal server or client maintenance pass can derive current planning again.
- [A user mutation is accidentally classified as system-authored] -> Classification requires the explicit existing actor marker, and focused tests prove actor-absent and user-authored patches retain rebase behavior.
- [A stale maintenance transaction contains both current and conflicting rows] -> Current rows upload normally, conflicting rows produce content-free supersession receipts, and the complete transaction then drains.
- [A native user queue is affected by this repair] -> Native completion patches do not carry the system actor marker, so they retain the existing durable retry path.

## Migration Plan

1. Deploy the web connector change through the normal BathOS publication path.
2. Reload the affected Safari Tasks installation so its durable queue retries through the new policy.
3. Verify the Safari queue drains to zero, a content-free supersession receipt exists, and downsync converges to the authoritative server state.
4. Reload the Mac container only if needed, preserving its user-authored durable queue, and verify those writes upload rather than being superseded.
5. Roll back by republishing the prior web bundle. No database or local-file rollback is required.

## Open Questions

None.

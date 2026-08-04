## Context

The checklist editor inserts a transient draft row at a logical checklist boundary. Today, a blank draft survives blur, and the draft plus the persisted row immediately after it can both render the same drop-before indicator.

## Goals / Non-Goals

**Goals:**

- Treat a blank blurred draft as abandoned transient UI.
- Preserve saving for nonblank drafts and active draft dragging.
- Give every logical insertion boundary one visual owner.

**Non-Goals:**

- Change the user-facing checklist ordering, completion, or autosave semantics.
- Add a new drag-and-drop system or alter task-list dragging.

## Decisions

- The editor clears a blank draft synchronously from local state on blur because no server mutation is needed for an unpersisted row.
- A draft rendered before a persisted item owns that boundary's drop indicator. The following persisted item suppresses its duplicate indicator while the draft occupies the same index.
- An actively focused empty draft remains draggable until focus leaves, preserving the existing draft-repositioning contract.
- Persisted checklist mutations use per-item mutation epochs so an earlier title or completion save cannot replace the order produced by a later drag.
- Checklist hierarchy patches that meet a newer authoritative revision are rebased and retried before PowerSync drains the local mutation. A rejected stale revision therefore cannot replace a successfully dropped local order with the older server order.
- Checklist order planning recognizes the fixed-width numeric ranks used by migrated and recurrence-generated items. New boundaries inside those checklists remain ordinal-compatible with the existing raw keys, while native fractional-rank checklists continue using the shared task rank generator.
- Draft commits read the current draft refs, not a render-time value. A task-close flush clears those refs before a subsequent blur handler can try to create the same logical item again.
- Pointer and keyboard checklist mutation handlers consume rejected promises and show the established destructive checklist toast. The underlying mutation still rejects to callers that explicitly await it, but browser-global unhandled rejection reporting is not used as UI.

## Risks / Trade-offs

- A drag start blurs its source input. The existing draft drag path must continue to retain the draft long enough to complete the drag, so cleanup is limited to ordinary blur rather than removing draft drag support.
- Local-state cleanup could leave stale focus bookkeeping. The blur path clears the draft focus identifier together with the draft state.
- Revision rebasing intentionally preserves only the fields in the original checklist patch while advancing its revision metadata. This avoids overwriting unrelated authoritative checklist fields.
- Numeric rank compatibility is intentionally scoped to checklist ordering. Other task collections already use fractional ranks and must not silently accept malformed keys.

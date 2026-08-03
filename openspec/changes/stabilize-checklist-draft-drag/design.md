## Context

The checklist editor inserts a transient draft row at a logical checklist boundary. Today, a blank draft survives blur, and the draft plus the persisted row immediately after it can both render the same drop-before indicator.

## Goals / Non-Goals

**Goals:**

- Treat a blank blurred draft as abandoned transient UI.
- Preserve saving for nonblank drafts and active draft dragging.
- Give every logical insertion boundary one visual owner.

**Non-Goals:**

- Change persisted checklist ordering, completion, or autosave semantics.
- Add a new drag-and-drop system or alter task-list dragging.

## Decisions

- The editor clears a blank draft synchronously from local state on blur because no server mutation is needed for an unpersisted row.
- A draft rendered before a persisted item owns that boundary's drop indicator. The following persisted item suppresses its duplicate indicator while the draft occupies the same index.
- An actively focused empty draft remains draggable until focus leaves, preserving the existing draft-repositioning contract.

## Risks / Trade-offs

- A drag start blurs its source input. The existing draft drag path must continue to retain the draft long enough to complete the drag, so cleanup is limited to ordinary blur rather than removing draft drag support.
- Local-state cleanup could leave stale focus bookkeeping. The blur path clears the draft focus identifier together with the draft state.

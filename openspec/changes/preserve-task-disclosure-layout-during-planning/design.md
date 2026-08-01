## Context

`TaskEditorForm` initializes checklist-content presence from the list-level checklist index, then receives the authoritative live presence from `TaskChecklistEditor`. Changing Start can move an open task outside the current list's ordinary projection while the editor remains intentionally retained. In that retained state, the list-level index can temporarily report the checklist as absent even though the mounted checklist editor still contains items.

## Goals / Non-Goals

**Goals:**

- Keep the disclosure layout derived from the mounted editor's actual content while an open task changes planning state.
- Preserve legitimate transitions back to the paired layout when the user actually deletes every checklist item.
- Keep an open Anytime task in its exact rendered Area bucket and within-bucket slot until the drawer closes.
- Cover the Someday transition as a regression case.

**Non-Goals:**

- Change checklist persistence, list eligibility, or editor-retention behavior.
- Change the established paired and stacked disclosure styling.
- Add database or native-companion work.

## Decisions

The list-level `hasChecklistItems` prop will remain a positive initialization and recovery signal, but it will no longer overwrite a live positive checklist-presence state with `false`. The mounted `TaskChecklistEditor` remains authoritative for negative transitions because it observes both persisted items and the draft row, and already reports when the checklist genuinely becomes empty.

This is preferable to keying the checklist editor by destination or remounting it after planning changes, which would discard local interaction state and create avoidable focus churn. It is also preferable to broadening the list-level checklist index because the open editor is deliberately allowed to outlive ordinary list eligibility.

For Anytime placement, the Area-section renderer will capture the open task's rendered section and index. While the same drawer remains open, each recomputed projection removes the task from any metadata-driven location and reinserts it into that captured slot. The row continues to render current metadata, so persistence and visible field feedback stay live without allowing Area, Deadline, Start, Actionability, or ordering changes to move the editor prematurely.

The captured slot is released only when the retained task identifier clears after the drawer-close sequence. This makes the close boundary the single point at which visible Area rebucketing and invisible automatic sorting may settle.

## Risks / Trade-offs

- A stale positive list-level signal could keep the layout stacked briefly while checklist data loads. -> The checklist editor reports authoritative presence after loading and can still transition the state to `false`.
- A future caller without a mounted checklist editor could need a negative reset. -> Each task editor is keyed to one task lifecycle and initializes directly from its task-specific prop; the current call sites mount the editor whenever a persisted task identifier exists.
- The captured numeric slot can outlive unrelated changes elsewhere in the same Area while the drawer is open. -> Clamp the insertion index to the current section length; the invariant intentionally prioritizes stability of the actively edited task.

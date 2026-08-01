## Context

The checklist editor renders persisted items in authoritative order and may also render transient blank draft rows. Completed items normally settle beneath incomplete items. The checklist shortcut currently prefers focusing the final unchecked row, which does not provide a predictable way to insert a new item at the active/completed boundary.

## Goals / Non-Goals

**Goals:**

- Make every checklist-shortcut invocation create one fresh blank editing row.
- Place that row before the first completed item, or at the end when no completed item exists.
- Focus the new row immediately without changing completion state or persisted order until text is committed.

**Non-Goals:**

- Changing Return-based splitting, pointer reordering, completion sinking, or multiline paste placement.
- Changing checklist persistence or database ordering semantics.
- Reordering existing incomplete or completed items.

## Decisions

- Compute the shortcut insertion index from the current visible checklist: the index of the first completed persisted item, falling back to the list length. This expresses the active/completed boundary directly and remains correct when a manually reopened item exists among completed rows.
- Represent the fresh item with the existing transient draft-row mechanism. This avoids persisting empty content and preserves close-time cleanup.
- Focus by the new draft row's identity rather than by querying for the last unchecked persisted item. This makes repeated shortcut invocations deterministic even before a draft receives text.

## Risks / Trade-offs

- [Risk] Existing draft rows could make repeated shortcut invocations ambiguous. -> Insert a new uniquely identified draft at the computed boundary and focus that exact row.
- [Risk] A manually reopened incomplete item may remain below completed items. -> The first completed item remains the boundary because the user explicitly asked for insertion above any checked items, not after every unchecked item.

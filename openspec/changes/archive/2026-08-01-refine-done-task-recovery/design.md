## Context

The Done view combines terminal task rows with roots returned by the recoverable deleted-hierarchy query. Checklist-item deletions are intentionally retained for undo, but rendering every hierarchy root promotes checklist history into a task-level list. Deleted task rows also reuse the generic reopen glyph and restore copy, while completed rows now use the canonical contained checked square.

## Goals / Non-Goals

**Goals:**

- Keep Done focused on completed, canceled, and trashed to-dos.
- Preserve deleted checklist-item records for undo while excluding them from Done presentation and empty-state calculations.
- Make completed and trashed task states visually distinct and use a single user-facing `Reopen` recovery term.
- Make selection-mode recovery and nondestructive organization edits work for any eligible Done selection.

**Non-Goals:**

- Delete or change checklist-item history, undo, retention, or purge behavior.
- Change the existing backend `restore` transition used to recover a deleted task hierarchy.
- Change database, synchronization, or native companion contracts.

## Decisions

### Filter only the Done presentation

The Done view will derive visible hierarchy roots by excluding `checklist_item` roots. The underlying hook and restore APIs remain unchanged, so undo and retention keep their current data.

Alternative considered: delete checklist-item tombstones after removal. Rejected because it would break deletion undo and exceeds the requested presentation correction.

### Use a dedicated deleted-task icon concept

Tasks iconography will map a `DeletedTask` concept to Lucide `SquareX`. The Done row will render it in the existing neutral completion-control color, while completed tasks continue to use `CompletedTask` in semantic success green.

Alternative considered: keep `RotateCcw`. Rejected because it describes the action but does not visibly distinguish the task's terminal state.

### Separate user-facing language from transition names

Controls, accessibility labels, ellipsis actions, and task-specific errors will say `Reopen`. The internal deleted-task transition remains `restore` because it performs hierarchy-safe recovery and is not exposed to the user.

### Specialize the bulk Edit menu by list semantics

The shared bulk Edit menu will receive independent capability flags instead of treating every action as one all-or-nothing eligibility set. In Done, Area and Actionability remain available, Start and Deadline remain unavailable for terminal records, Delete is omitted entirely, and Reopen is shown. Outside Done, the existing active-task menu remains unchanged.

Bulk Reopen will assign one operation identity to the user action while mapping each selected task to its required guarded transition: `restore` for deleted tasks and `reopen` for completed or canceled tasks. This preserves the hierarchy-safe restore path without exposing its implementation name.

The atomic bulk patch repository will accept Area and Actionability patches for terminal tasks because the ordinary task editor already permits those metadata edits. Other bulk patches continue to require open, present tasks.

## Risks / Trade-offs

- [Risk] A Done view containing only hidden checklist-item roots could appear non-empty with no rows. -> Compute emptiness from the filtered root collection.
- [Risk] Filtering the shared hook could unintentionally remove checklist history from undo. -> Filter only the local Done render projection.
- [Risk] Icon and label drift across legacy row implementations. -> Update canonical iconography and retained terminal-row copy, then cover the active TaskRow path with focused tests.
- [Risk] Treating Done eligibility as one flag can disable valid submenus or expose invalid destructive actions. -> Model organization, temporal, delete, and reopen capabilities independently and verify the rendered menu.
- [Risk] A mixed recovery selection requires different internal transitions. -> Choose the transition per task while sharing one operation identity and retaining the existing optimistic rollback behavior for failures.

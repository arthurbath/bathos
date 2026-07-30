## Context

The fixed task-selection toolbar currently mixes `Plan Selected`, `Cancel`, and `Done`, while keyboard commands open separate selection-owned date and organization surfaces. Successful planning clears the user's selection even when the edited tasks remain visible. The singular task ellipsis menu already establishes the preferred Start, Deadline, Area, Actionability, Repeat, and Delete vocabulary.

## Goals / Non-Goals

**Goals:**

- Make the selection toolbar concise and consistent with the task ellipsis menu.
- Apply one bulk edit atomically where the data layer supports a bulk patch.
- Retain selection mode and selected membership after an edit, pruning only tasks that leave the current view.
- Preserve an intentional empty selection mode after an edit removes every selected task.

**Non-Goals:**

- Bulk recurrence creation or editing.
- New database operations, schemas, or native-app surfaces.
- Changing the existing Control-based task commands.

## Decisions

1. The toolbar will contain only `Select All`, `Edit...`, and `Cancel`. `Cancel` is the sole explicit exit action and remains available at zero selected tasks.
2. `Edit...` will use the shared BathOS dropdown-menu primitives and mirror the singular task menu's Start, Deadline, Area, Actionability, and Delete structure. Repeat is intentionally absent.
3. Start and Deadline will open the existing centered selection-owned pickers. Area and Actionability will use nested menu choices and one bulk patch. Delete will use the existing recoverable task deletion transition.
4. Successful edits will not clear selection. The existing visible-task reconciliation will remove task IDs that no longer belong in the current rendered view, but it will no longer exit selection mode when that reconciliation reaches zero.
5. Manual deselection of the final task retains the established behavior of exiting selection mode. This distinguishes intentional deselection from an edit-induced empty result.

## Risks / Trade-offs

- [Risk] A bulk edit changes list membership while synchronized data is still settling. -> Keep selection keyed by task ID and prune it from the authoritative visible-task projection.
- [Risk] Terminal Done tasks cannot accept every active-task edit. -> Disable lifecycle-ineligible edit choices rather than bypassing repository validation.
- [Risk] Sequential terminal transitions can partially fail. -> Keep selection available on failure and use the existing recoverable mutation error path.

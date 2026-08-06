## Context

The ordinary task drawer currently treats Notes as permanently present while Link and Checklist use separate disclosure controls near their content positions. The task keyboard command layer can open a task and add a checklist row, but it has no direct commands for revealing and focusing Notes or Link. Checklist insertion also has only one destination even when the user is already editing its ordinary end-of-active-items draft.

This change is confined to the Tasks module. It must preserve task autosave, ordinary text editing, recurrence-prototype reuse of the task editor, checklist undo history, and the native quick-entry surface's existing command restrictions.

## Goals / Non-Goals

**Goals:**

- Make Notes, Link, and Checklist consistent optional task-content disclosures.
- Keep the disclosure actions in one stable, evenly distributed row at the bottom of the drawer.
- Add deterministic keyboard access to Notes and Link with useful caret placement.
- Extend the checklist command without changing its established ordinary insertion slot.
- Keep keyboard help and regression tests synchronized with executable behavior.

**Non-Goals:**

- Rename the `primary_link` data field or change link activation behavior.
- Change persistence, database, PowerSync, RPC, or native-wrapper contracts.
- Add multi-task field-focus behavior.
- Change checklist ordering or completion semantics outside the keyboard insertion command.

## Decisions

### Keep optional-content disclosure as editor-local UI state

The editor will initialize Notes and Link visibility from committed nonempty task values and Checklist visibility from existing items. Activating an add action or its keyboard command reveals the associated control for the current open-editor lifetime. Because an empty revealed field is not a new persisted semantic value, closing and reopening the drawer naturally restores its add action.

This avoids adding durable presentation flags to task records. A persisted empty string continues to mean that the optional content is absent.

### Route field commands through the single-task command target

Control+H and Control+N on Mac, with Alt+Shift equivalents on Windows, will use the same single-task resolution used by other task commands. An open task, a keyboard-focused task, or exactly one task selected in selection mode is eligible. Multiple-task selections and ambiguous targets will not run the commands. A closed target opens first, then a pending focus request is fulfilled after the editor control mounts.

When the requested control is already focused with a collapsed caret at its end, the command moves the caret to the beginning. Every other invocation focuses the control and places the caret at the end. This produces a deterministic beginning/end toggle without disturbing an active nonterminal selection.

### Coordinate checklist insertion through the checklist editor

The task shell will continue dispatching the checklist command to the open checklist editor. The editor will identify whether the active element is the empty draft at the ordinary insertion slot immediately before completed items. Only in that state will the next command move that transient draft to index zero and focus it. Invoking the command from that top draft moves it back to the ordinary insertion slot, producing the requested focus bounce without persisting duplicate empty checklist records. All other invocations retain the established ordinary insertion slot.

### Render one stable optional-content action row

The drawer will derive an ordered list of missing content types and render them as shared primary-outline buttons labeled `+ Notes`, `+ Link`, and `+ Checklist`. The group uses equal-width columns across the available drawer width, removes redundant inter-action separators, and stays after the drawer's editable metadata/content. The checklist remains the last content editor when all optional types exist. A conditional compact-bottom treatment applies only when no disclosure actions remain and Checklist is the final content.

### Limit Primary Link renaming to user-facing copy

Visible labels, placeholders, accessible action names, and keyboard help will say `Link`. Internal types, props, database fields, protocol logic, and specification references that identify the underlying model may retain `primaryLink` or Primary Link where needed for technical clarity.

## Risks / Trade-offs

- [Risk] Focus requests can race editor mounting or disclosure state updates. -> Use an explicit pending focus target fulfilled by the mounted input ref after React commits.
- [Risk] A global Control command could steal ordinary text editing. -> Handle only the exact platform task chord and only when one task target is resolvable, while preserving the command's specified behavior from within its own field.
- [Risk] Moving optional content to the drawer bottom could diverge between ordinary tasks and recurrence prototypes. -> Keep the behavior in the shared task-editor path and cover both task shapes where existing tests expose them.
- [Risk] Empty checklist drafts are transient and can make position detection ambiguous. -> Base the toggle on the focused draft identity, its empty value, and current index, not merely on empty text.

## Migration Plan

No data migration is required. Ship the Tasks client and regression tests together. Rollback consists of reverting the client and delta specification because stored task data is unchanged.

## Open Questions

None.

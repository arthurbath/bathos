## Context

Tasks currently has three temporal entry patterns. The expanded editor opens the reusable `TaskStartPickerPanel` or shared date-picker calendar in a popover, the task ellipsis menu opens `TaskStartDialog` with redundant dialog chrome, and selection-mode commands open a titled `TaskBulkCommandDialog` containing another date field. Focused-task commands also open the complete metadata editor merely to reach one temporal control.

The action menu is row-owned, while keyboard commands are routed by `TasksShell`. A single task picker therefore needs a small row-level command bridge, whereas selection-mode surfaces remain shell-owned.

## Goals / Non-Goals

**Goals:**

- Reuse one Start panel and one Deadline calendar panel across editor, menu, focused-command, and bulk-command entry points.
- Keep single-task surfaces anchored under the summary row after deterministic scroll alignment.
- Keep selection-mode temporal surfaces centered without scrolling to an arbitrary selected row.
- Replace obsolete menu actions with direct Area and Actionability submenus.
- Preserve autosave, undo, reminder, calendar, keyboard traversal, and sorting behavior.

**Non-Goals:**

- Changing task persistence, reminder authority, recurrence data, or list sorting rules.
- Replacing the existing expanded editor controls.
- Adding bulk Area or Actionability context-menu workflows.
- Changing recurrence-projection menus or terminal-task restore behavior.

## Decisions

### Reuse panel content independently from its trigger

`TaskStartPickerPanel` and the shared Deadline calendar content will be exposed as controlled picker content. Existing field components continue to own their trigger behavior, while row and bulk surfaces provide alternative positioning containers around the same content.

This avoids cloning calendar logic or simulating clicks on hidden editor controls. A hidden editor would also incorrectly expand the task and alter scroll height.

### Use a row-targeted temporal command event

`TasksShell` will dispatch a task-id and temporal-mode command to the target row. The mounted row already owns its task-specific persistence callbacks, reminder state, summary element, and picker-open state, so it can align the correct row and open the corresponding controlled popover without broad prop plumbing through every list renderer.

The existing Start advancement event remains panel-local. Control+E first advances an already-open Start picker and only dispatches a row-open command when no Start picker is active.

### Separate anchored and centered positioning

Single-task actions use a Radix Popover anchored to the summary row center. The row aligns to the visible content boundary before the picker opens, then the popover collision system keeps the panel inside the viewport.

Selection-mode Start and Deadline commands use a content-only centered dialog surface without a title, descriptive copy, footer, or close button. This retains modal focus containment and outside/Escape dismissal while presenting only the shared picker.

### Keep nested metadata actions inside the context menu

Area and Actionability use the existing Radix dropdown submenu primitives. Area offers No Area followed by configured Areas. Actionability offers Ready, Rechecking, and Waiting, with the current value disabled. Selecting a value uses the ordinary task update path so undo, retention while open, and eventual sorting remain unchanged.

## Risks / Trade-offs

- [Popover positioning may be measured before scrolling completes] -> Align the row first and defer opening through animation frames so Radix measures the settled summary position.
- [A command event could outlive or target a nonvisible row] -> Include the task id in the event and let only the matching mounted row respond.
- [Refactoring the shared Deadline calendar could alter existing field behavior] -> Keep the current field wrapper and extract only its already-rendered picker content, backed by existing and new focused tests.
- [Selection-mode centered content removes the explanatory count] -> The active selection bar already communicates selection scope, and the requested compact surface prioritizes direct manipulation.

## Migration Plan

This is an application-only compatible release. Deploy the web bundle after tests and rendered validation. Rollback consists of restoring the prior menu and dialog wrappers; no data migration or cleanup is required.

## Open Questions

None. `No Area` is retained as the first Area submenu choice so users can clear an existing assignment.

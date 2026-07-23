## Context

`TasksShell` owns both the current bulk-selection state and the module-wide keyboard capture listener. To-do rows already expose a stable `data-task-row-id` marker used for editor dismissal, so the same row boundary can define whether a pointer interaction belongs to a to-do.

## Goals / Non-Goals

**Goals:**

- Treat pointer interaction outside every to-do row as an explicit exit from bulk selection.
- Handle platform select-all at the module level before the browser does when the event is not owned by an editable control.
- Select only the to-dos represented in the active planning view's current task collection.
- Preserve all existing row interactions and native text-editing selection.

**Non-Goals:**

- Selecting projects, areas, templates, Done hierarchy roots, or to-dos outside the active view.
- Adding a persistent selection-mode entry control or changing bulk planning actions.
- Changing database, synchronization, or server behavior.

## Decisions

### Reuse the to-do row boundary for outside dismissal

A capture-phase document pointer listener will clear bulk state only when selection is active and the target is neither inside `[data-task-row-id]` nor inside the bulk toolbar or its planning dialog. This keeps every child control within a to-do row inside the selection context, preserves the controls needed to operate the active selection, and makes headers, navigation, whitespace, capture controls, unrelated dialogs, and other non-to-do surfaces dismiss it.

Checking the stable row marker is preferred over enumerating every non-dismissal control because new controls added inside a row inherit the correct behavior automatically.

### Handle select-all independently of selection entry

The module keyboard listener will recognize the platform primary-modifier `A` gesture before consulting commands that do not include select-all. When the active view supports bulk planning and contains to-dos, it will prevent the browser command, close any open to-do editor, establish the first visible to-do as the range anchor, enter bulk mode, and replace the selection with every current to-do identifier.

Direct handling in `TasksShell` is preferred over synthesizing pointer gestures because select-all is a list operation and does not need row-specific modifier semantics.

### Preserve native selection in editable controls

Inputs, textareas, selects, and contenteditable descendants retain Command+A or Control+A. The list-level command is therefore available from non-editable Tasks chrome and task-title buttons without disrupting title, notes, or capture editing.

## Risks / Trade-offs

- **The bulk planning dialog is portal-rendered outside a to-do row** -> Mark the toolbar and its planning dialog as selection-owned surfaces so the controls needed to act on the selection remain usable.
- **The projected task list changes during selection** -> Existing selection pruning remains authoritative, while each select-all gesture takes a fresh snapshot of the current `tasks` collection.
- **Browser select-all occurs before React handles the command** -> Continue using the existing capture-phase native window listener and call both `preventDefault` and `stopImmediatePropagation` when Tasks owns the gesture.

## Migration Plan

This is a web-only interaction change with no migration. Rollback consists of restoring the prior shell event handlers and tests.

## Open Questions

None.

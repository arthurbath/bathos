## Context

`TaskRow` currently overrides Radix Dropdown Menu close autofocus and restores whole-task focus to the row. Menu-launched Move, Do, and Start surfaces also restore that row when they close, while terminal menu actions restore either the current row or a neighboring fallback. Those paths make pointer-oriented ellipsis-menu use create a persistent keyboard-navigation state.

## Goals / Non-Goals

**Goals:**

- Relinquish whole-task focus after the ellipsis menu closes for any reason.
- Preserve focus ownership while a menu-launched nested surface remains open, then leave no task focused when that surface closes.
- Avoid focusing a fallback task after a terminal action initiated from the ellipsis menu.
- Retain existing focus restoration for direct completion controls, Tasks keyboard commands, and non-menu task actions.

**Non-Goals:**

- Changing task selection, bulk selection, row Tab order, or Space and arrow traversal.
- Removing accessible focus handling inside the menu or its nested dialogs.
- Changing task mutations, animation, persistence, or list membership.

## Decisions

Use the existing shell-owned whole-task focus clearing callback rather than blurring or focusing another task from inside `TaskRow`. Prevent Radix close autofocus so the trigger does not regain DOM focus, then clear the Tasks focus state. This keeps the menu interaction from manufacturing row focus while allowing the browser to settle focus naturally after the portal closes.

Track terminal-action origin explicitly. Terminal actions invoked by other controls keep their existing same-position fallback, while an ellipsis-menu Delete skips that fallback and clears whole-task focus.

Pass the focus-clearing callback to Move, Do, and Start as their close-autofocus handler when those surfaces originate from the ellipsis menu. Their controls remain fully keyboard operable while open.

## Risks / Trade-offs

- [Risk] A keyboard user who opens the ellipsis menu and closes it returns to the document rather than the trigger. -> Mitigation: This is the requested contract, and task-level keyboard commands remain the primary keyboard workflow.
- [Risk] Reusing a generic terminal helper could accidentally remove focus restoration from direct completion or keyboard actions. -> Mitigation: Add an explicit menu-origin option and focused regressions for both menu and non-menu paths.
- [Risk] Radix may attempt trigger autofocus after the clear operation. -> Mitigation: Continue preventing close autofocus and assert both DOM focus and whole-task focus state after dismissal and selection.

## Context

Task title controls are native buttons. Pointer activation therefore gives the clicked title button DOM focus before Tasks converts the interaction into bulk selection. Although selection state correctly clears lightweight whole-task focus, that native button focus can remain and later become visibly focus-indicated when the user presses Shift.

## Goals / Non-Goals

**Goals:**

- Remove incidental DOM focus created by pointer-driven selection.
- Preserve Command/Control toggling, Shift-click range replacement, stable anchors, selected styling, and keyboard task navigation.
- Keep genuinely keyboard-established focus visible and accessible.

**Non-Goals:**

- Changing selection membership rules.
- Suppressing native focus for ordinary task opening or keyboard traversal.
- Introducing a global rule that hides focus-visible styling.

## Decisions

- Blur the clicked summary control after Tasks accepts a pointer selection gesture. This targets the browser focus side effect rather than masking it with CSS.
- Keep selection state and DOM focus independent. Selected tasks remain represented by selection controls and blue row styling, while `focusedTaskId` remains reserved for keyboard navigation.
- Test the focused element and visual focus contract after both platform-modifier and Shift-click selection, followed by bare Shift.

## Risks / Trade-offs

- [Risk] Blurring too broadly could remove focus from selection-owned dialogs or controls. → Mitigation: blur only the pointer event's current task summary control as the selection gesture is accepted.
- [Risk] A delayed state transition could restore focus. → Mitigation: assert focus after the asynchronous editor-close and selection-state transition completes.

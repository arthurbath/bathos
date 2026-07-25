## Context

Tasks currently uses `selectedTaskId` for the open editor and a separate bulk-mode flag plus selected-ID set for every modified-click selection. Each collapsed row exposes the completion control, title button, source link, and actions trigger as separate Tab stops. Command targeting therefore understands an open task or bulk selection, but not one closed focused task.

The revised interaction has four mutually exclusive user-facing states:

1. No task target.
2. One closed task focused.
3. Two or more tasks selected with bulk controls.
4. One task open for editing.

The existing autosave, completion deferral, local-first persistence, and ordered task-list projection remain authoritative.

## Goals / Non-Goals

**Goals:**

- Make each visible task row one persistent keyboard focus target.
- Restore every available task-summary control to native Tab and Shift+Tab traversal and let that traversal continue outside the task list.
- Add a distinct Space-driven whole-task focus path that enters at the first visible task, promotes a Tab-focused row without advancing it, advances with Space, reverses with Shift+Space, and ignores held-key repetition.
- Wrap ArrowDown, ArrowUp, Space, and Shift+Space whole-task traversal through the flattened visible task order.
- Preserve native Space behavior outside the two approved whole-task focus contexts.
- Keep single focus visually and behaviorally distinct from multi-selection.
- Let all supported task commands target one focused closed task.
- Preserve direct pointer behavior for completion, links, and the actions menu.
- Restore whole-row focus after close, movement, duplication, or terminal removal whenever a legal fallback exists.

**Non-Goals:**

- Add a dedicated Tasks-specific keyboard command for the ellipsis menu beyond its restored native Tab and activation behavior.
- Add task-row keyboard reordering.
- Change task persistence, synchronization, reminders, or database schema.
- Include projects, areas, templates, deleted hierarchy records, or checklist items in task-row traversal.
- Make Space traversal operate from an interactive control, editor, open task, multiple selection, nested overlay, or unrelated page control.

## Decisions

The shell will retain the existing open-task identifier and add a distinct closed `focusedTaskId`. Bulk selection will represent only two or more task IDs. Transition helpers will collapse a one-member selection into closed focus and clear focus when no members remain. Opening a task clears closed focus and bulk selection; entering multi-selection closes an open task first.

Command target precedence will be multi-selection, open task, then focused closed task. Commands that require inline controls will first open a focused closed task and then open the requested Start, Deadline, Organization, Reminder, or Checklist surface. Immediate commands such as completion, actionability, Start clearing, horizon cycling, Copy, and Cut can operate directly.

Actionability cycling will remain per-task for a single target. For multiple targets, the shell will derive one group-level destination before writing any task: all Waiting advances to Rechecking, all Rechecking advances to Actionable, and every other combination converges to Waiting. This prevents independent cycling from preserving or creating a mixed bulk state.

The task card and every available interactive control in its collapsed summary will participate in the native sequential Tab order. The row remains a named focus target whose Return handling opens the task, but Tasks will not prevent Tab or Shift+Tab. Beginning granular Tab traversal clears logical whole-task focus without blurring the current DOM target, allowing the browser to proceed to the next or previous task sub-control and eventually leave the list.

Logical `focusedTaskId` will represent whole-task focus established by a modified click, task-command focus restoration, or the Space navigation path rather than ordinary DOM focus alone. Unmodified Space on an eligible noninteractive Tasks page surface with no task target will focus the first visible task. Space on a granularly Tab-focused row will promote that same row without advancing it. Later Space and Shift+Space presses advance or reverse through visible task rows with wrapping. ArrowDown and ArrowUp use the same wrapped order while whole-task focus is active. All of these movements reuse the existing `focusTaskRow` scroll restoration.

Space handling will reject modifier chords other than Shift+Space, composition, held-key repetition, open tasks, multiple selection, nested overlays, editable controls, links, buttons, controls with interactive roles, and unrelated page controls. Repeated Space on an already whole-task-focused row is prevented only to avoid page scrolling and performs no movement. Native controls remain responsible for their own Space activation.

Modifier gestures apply only to the task activation surface, never to completion, links, or actions. A first Command-click, Control-click, or Shift-click establishes closed focus and an anchor. A later additive click creates multi-selection, while Shift-click creates or replaces the anchored contiguous range. Reducing a multi-selection to one task dismisses bulk controls and transfers closed focus to the remaining task.

The Open/Close Task command will open the focused closed task or close the open editor. Close waits for autosave and deferred completion, then focuses the surviving row or the ordinary same-position fallback. Control+S and Control+W retain their open-as-you-traverse behavior, using closed focus as their current position when no editor is open and remaining nonwrapping at list boundaries.

Escape on a collapsed task row or one of its granular controls will clear logical whole-task focus, clear the range anchor, and blur the active row-owned element. Nested dialogs, menus, listboxes, popovers, and open editors retain their existing Escape ownership and close behavior.

Every action-driven return to the collapsed task list will use the shell's `focusTaskRow` authority rather than calling `.focus()` on a row or trigger directly. This includes successful and failed terminal actions, action-menu commands, task-owned dialog dismissal, and same-position fallback after a task leaves the current projection. Native Tab traversal may still focus nested controls deliberately; only action restoration is normalized to whole-task focus.

Single-focus presentation will use the existing semantic focus ring without showing selection circles or the fixed bulk toolbar. Multi-selection continues using selection controls and selected-card treatment. Assistive names will describe the complete task row and its open or selected state without pretending that the row is a nested interactive button.

## Risks / Trade-offs

- [Risk] Restoring nested task controls lengthens Tab traversal through large lists. → Mitigation: Space, Shift+Space, ArrowDown, and ArrowUp provide a faster wrapped whole-task path without replacing native granular access.
- [Risk] Browser focus and logical focused-task state can drift after async list projection. → Mitigation: Reconcile focused IDs against the current visible task set and use one focus-restoration helper with same-position, prior-task, and first-task fallbacks.
- [Risk] A modifier click on a nested link could be mistaken for task selection. → Mitigation: Bind selection only to the task activation surface and stop it from observing direct-control events.
- [Risk] A global Space listener could steal activation or scrolling from controls and assistive technology. → Mitigation: Claim Space only from an eligible noninteractive Tasks background with no task target or from the row element itself, and preserve all native interactive and nested-surface ownership.
- [Risk] Native Tab focus and logical whole-task focus could remain active together. → Mitigation: Clear only the logical focus and anchor when Tab begins, preserve DOM focus, and let the browser perform the granular traversal.
- [Risk] Focused closed tasks broaden Copy, Cut, Duplicate, and metadata-command scope. → Mitigation: Centralize target resolution and preserve native clipboard behavior whenever an editable control owns the chord.
- [Risk] A partially applied bulk actionability cycle could leave the selection mixed despite a group-level destination. → Mitigation: Determine the destination once before writes and retain the existing error reporting so a failed operation remains visible and retryable.
- [Risk] A broad Escape handler could dismiss an open editor or steal dismissal from a nested surface. → Mitigation: Claim Escape only for collapsed task rows after nested-surface ownership has been excluded.
- [Risk] Normalizing focus after an action could interfere with native granular Tab traversal. → Mitigation: Restore whole-task focus only from explicit action completion and dismissal paths, never from ordinary `focusin` events.

## Context

Closed-task completion uses a reversible grace period before the terminal mutation and removal animation. The task row currently captures its list position and restores focus after every completion, including a pointer click. Keyboard completion reaches the same button programmatically, so the row must preserve the completion origin through the grace period.

## Goals / Non-Goals

**Goals:**

- Preserve successor focus for keyboard-originated closed-task completion.
- Suppress successor task focus for pointer-originated closed-task completion.
- Keep completion grace, animation, undo reservation, and persistence unchanged.

**Non-Goals:**

- Changing focus behavior for open-task deferred completion, bulk completion, reopening, deletion, or ellipsis-menu actions.
- Changing terminal mutation timing or stored task data.

## Decisions

- Treat a completion-control click with zero click detail as keyboard-originated. Native keyboard activation and the Tasks completion shortcut both produce this activation form, while a pointer click carries pointer click detail.
- Store the focus-restoration decision beside the completion reservation for the full grace period. The eventual terminal action therefore applies the correct focus policy after its delayed animation.
- Reuse the existing `runTerminalAction` focus switch instead of adding a second focus-restoration implementation.

## Risks / Trade-offs

- [Risk] A synthetic test click defaults to keyboard-like click detail and could conceal the pointer path. -> Mitigation: pointer regression tests dispatch an explicit click with pointer detail, and keyboard tests exercise the real shortcut.
- [Risk] The completion grace may be canceled before commit. -> Mitigation: reset the stored focus origin whenever grace is canceled or committed.

## Context

The task ellipsis menus use Radix Dropdown Menu, which ordinarily restores focus to the trigger when the menu closes. The ordinary task menu already cancels that close autofocus callback and clears whole-task focus, but a pointer-outside dismissal can still leave the trigger as the active element. Recurrence prototypes use the default restoration behavior entirely.

## Goals / Non-Goals

**Goals:**

- Ensure pointer-outside dismissal leaves neither ordinary-task nor recurrence-prototype ellipsis triggers focused.
- Keep menu selection, keyboard dismissal, and task mutation behavior otherwise unchanged.
- Cover the observed interaction with a regression test.

**Non-Goals:**

- Changing whether the outside click activates the underlying target.
- Changing task-row whole-task focus rules outside ellipsis-menu dismissal.
- Altering the shared Dropdown Menu primitive for unrelated BathOS menus.

## Decisions

- Keep the fix local to task ellipsis triggers. Each affected row holds a trigger ref, cancels Radix close autofocus, and explicitly blurs the trigger if it remains active after dismissal. This avoids changing every BathOS dropdown.
- Apply the same rule to recurrence prototypes because their ellipsis controls represent the same task action-menu interaction in Upcoming.
- Retain the ordinary task menu's existing whole-task focus clearing callback.

## Risks / Trade-offs

- [Risk] Blurring on every close could remove focus after keyboard selection as well as pointer dismissal. -> Mitigation: the existing Tasks contract already requires ellipsis-menu interactions to relinquish trigger and whole-task focus, and the change is scoped only to those menus.
- [Risk] A clicked focusable control may receive focus after the menu closes. -> Mitigation: blur only when the trigger itself remains the active element, preserving native focus on any newly focused outside control.

## Context

The task editor is disclosed by animating a grid row from zero to its natural height. The form inside that animated row currently has a small top padding, so the last pixels of the disclosure read as a separate spacing expansion after the drawer itself appears open.

## Goals / Non-Goals

**Goals:**

- Make opening and closing the task editor read as one continuous disclosure.
- Remove the unnecessary top inset while retaining the established horizontal and bottom spacing.
- Preserve reduced-motion behavior, focus placement, scrolling, and autosave semantics.

**Non-Goals:**

- Changing the disclosure duration or easing.
- Redesigning task-editor fields.
- Changing task persistence, synchronization, or list projection.

## Decisions

- Remove the form's `pt-1` class instead of adding another animation or nested transition. The artifact is caused by spacing inside the already animated height, so eliminating the unwanted spacing fixes both layout and motion at the source.
- Keep the existing grid-row disclosure as the single animation owner. Introducing a separate padding transition would preserve the two-stage visual effect and add unnecessary timing coordination.
- Assert the absence of top padding in the existing task-editor layout regression test.

## Risks / Trade-offs

- [Risk] The title field sits slightly closer to the task summary row. → Mitigation: Retain the existing editor structure, field spacing, horizontal inset, and bottom padding so the drawer remains visually contained.
- [Risk] A CSS-only change could regress without a browser-level pixel comparison. → Mitigation: Cover the exact spacing contract in the rendered shell test and retain the existing disclosure-state test.

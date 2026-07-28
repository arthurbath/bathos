## Context

Collapsed task metadata is rendered as one flat sequence of conditionally present elements. Actionability currently renders after Deadline and Checklist, while the desired scan order places it between Reminder and Deadline.

## Goals / Non-Goals

**Goals:**

- Move non-Ready actionability directly after Reminder and before Deadline.
- Preserve all existing visibility, iconography, color, accessibility names, and responsive Deadline copy.
- Lock the complete canonical order with a focused regression test.

**Non-Goals:**

- Change actionability values, mutation behavior, or quick filters.
- Change task-row height, spacing, styling, persistence, or synchronization.
- Add placeholders for metadata that is not present.

## Decisions

- Reorder the existing conditional JSX blocks instead of introducing a metadata-array abstraction. The row already has a small fixed sequence, so a structural abstraction would add complexity without improving this focused change.
- Keep Checklist after Deadline. The requested placement constrains Actionability relative to Reminder and Deadline, while all other metadata retains its current relative order.
- Update the existing complete-metadata regression to assert the full sequence `area`, `horizon`, `reminder`, `actionability`, `deadline`, `checklist`.

## Risks / Trade-offs

- [Risk] A future metadata insertion could accidentally disturb the canonical order. → Mitigation: retain an exact ordered-child assertion in the task-row test.
- [Risk] Conditionally absent Reminder or Actionability could create unexpected gaps. → Mitigation: preserve the existing conditional rendering and flex gap behavior.

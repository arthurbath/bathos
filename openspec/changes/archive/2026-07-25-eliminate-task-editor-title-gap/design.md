## Context

The expanded task form uses `space-y-3` for 12-pixel separation between direct children. Its first child is a visually hidden Title label, so Tailwind's sibling-margin selector applies `margin-top: 12px` to the title input even though the label occupies no visible space. The clipped grid disclosure reveals that margin at the end of the height transition, producing the reported second step.

## Goals / Non-Goals

**Goals:**

- Remove all computed spacing between the summary row and title input.
- Preserve the existing 12-pixel spacing between visible form fields.
- Preserve the screen-reader label and all field ordering, focus, scrolling, autosave, and reduced-motion behavior.

**Non-Goals:**

- Changing disclosure duration, easing, or scroll behavior.
- Removing or visually exposing the accessible Title label.
- Redesigning any form control.

## Decisions

- Replace `space-y-3` with `flex flex-col gap-3`. Flex gap separates only in-flow items, while the absolutely positioned `sr-only` label does not create a leading gap before the title input.
- Do not patch the title input with an important margin override. Fixing the container's layout model avoids coupling the title control to the selector details of `space-y-*`.
- Extend the rendered layout regression to require the column layout, preserved 12-pixel gap, and absence of margin-based spacing.

## Risks / Trade-offs

- [Risk] Flex layout could change child sizing. → Mitigation: Column flex stretches children across the available width by default, matching the current block layout; focused Tasks shell tests and live geometry checks verify the result.
- [Risk] Removing the top gap could make the first field appear crowded. → Mitigation: This is the requested compact boundary; the existing summary row height, horizontal inset, field height, and editor background continue to provide containment.

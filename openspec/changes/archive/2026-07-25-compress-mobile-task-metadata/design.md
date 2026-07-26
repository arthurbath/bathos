## Context

Collapsed task rows use one bounded metadata line for hierarchy, actionability, planning, deadline, and reminder details. On mobile, full Waiting or Rechecking labels and relative deadline phrases consume space that is more valuable for the hierarchy label.

## Goals / Non-Goals

**Goals:**

- Reclaim mobile metadata width without removing meaning or accessibility.
- Keep desktop metadata wording unchanged.
- Make the deadline shorthand correct for dates at any distance from the planning date.
- Reduce only the task row's leading inset, without shrinking its controls.

**Non-Goals:**

- Changing deadline storage, urgency color, reminder behavior, or planning semantics.
- Changing actionability state or icons.
- Applying the mobile shorthand to expanded editor controls or non-Tasks modules.

## Decisions

- Render responsive visual variants inside the existing metadata items. Mobile receives icon-only actionability and compact deadline text, while the larger-breakpoint labels remain unchanged.
- Keep the metadata item's accessible name as the complete human-readable phrase so visual compression does not reduce assistive context.
- Add a calendar-date domain formatter for signed day offsets instead of parsing display prose. This keeps offsets correct outside the existing ten-day relative-label window.
- Reduce the leading task-row padding by one Tailwind spacing step and leave the trailing inset and 40-pixel completion target unchanged.

## Risks / Trade-offs

- **Risk: icon-only actionability may be unfamiliar initially** -> Preserve the accessible name and established Waiting and Rechecking symbols.
- **Risk: signed counts can be misread without units** -> Always include the compact `d` unit and retain the danger-red overdue treatment.
- **Risk: responsive duplicate text could be announced twice** -> Mark the visual variants as hidden from assistive technology and retain one explicit accessible name on the metadata item.

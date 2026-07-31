## Context

The unified Start picker already renders the Reminder field and alarm action as one input group and already computes whether any legal whole-hour choices remain. The action has the same low-contrast treatment as passive input decorations, so its interactivity and disabled state are not sufficiently legible.

## Goals / Non-Goals

**Goals:**

- Make the alarm action read as a button appended to the Reminder input.
- Preserve the existing keyboard, popover, and reminder-hour eligibility behavior.
- Make the exhausted Today or no-Start state visibly disabled.

**Non-Goals:**

- Changing reminder time parsing or the available-hour calculation.
- Adding new button variants to the shared component library.
- Changing Start-picker geometry or introducing labels/helper text.

## Decisions

- Add a semantic border between the input and action rather than wrapping the icon in a second container. This preserves the existing input group while making the control boundary obvious.
- Use the native `disabled` state plus explicit muted disabled styling. The existing availability calculation remains the single source of truth.
- Cover both enabled and exhausted states in the existing Start-picker tests.

## Risks / Trade-offs

- **Risk: The divider may look doubled against the input outline.** → Keep the outer group border unchanged and add only the internal left divider.
- **Risk: Disabled styling could make the icon illegible.** → Retain sufficient muted contrast while removing hover and active feedback when disabled.

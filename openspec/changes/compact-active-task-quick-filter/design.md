## Context

The Tasks list header currently puts the active quick-filter name inside the filter trigger. That changes the action row's width after applying a filter and can wrap the controls on mobile. The Select Tasks trigger already provides a compact semantic active treatment that does not change dimensions.

## Goals / Non-Goals

**Goals:**

- Keep every list-level action in a stable icon-sized footprint.
- Make an active filter apparent both at the control and in the list's identity area.
- Reuse established Tasks selection-active styling rather than add another active-control language.
- Preserve accessible filter naming and the existing filter popover behavior.

**Non-Goals:**

- Change the fixed quick-filter options, persistence, or filtering semantics.
- Change toolbar actions outside the Tasks primary lists.
- Add responsive-only divergent behavior.

## Decisions

The filter trigger will always use the clear icon-button variant and the same dimensions as the adjacent actions. When active, it will receive the same rounded `info` background and foreground treatment as Select Tasks. This keeps the affordance consistent and avoids layout changes at every viewport width.

The active filter name will render as muted secondary text in the same heading group as the list title. This makes the filter part of the current list context while retaining the original list title as the page heading. The subtitle will be absent for All Tasks.

The trigger's accessible name will continue to include the active filter name. The visual label moves, but assistive technology retains the current context on the control itself.

## Risks / Trade-offs

- [A subtitle adds height beneath the list title] -> Render it only for active filters and use compact secondary typography.
- [Duplicating the active treatment could drift] -> Use the exact class expression already established by Select Tasks and cover both controls in regression tests.
- [A filter name could be mistaken for another heading] -> Keep it visually subordinate and outside the heading element.

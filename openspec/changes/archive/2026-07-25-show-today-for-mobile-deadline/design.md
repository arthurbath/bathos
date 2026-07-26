## Context

Collapsed task rows already render separate mobile and non-mobile Deadline labels. The mobile branch calls one domain formatter that currently returns signed numeric day offsets for every value, including zero.

## Goals / Non-Goals

**Goals:**

- Return `Today` for the mobile zero-day Deadline case.
- Preserve signed numeric mobile copy for every nonzero offset.
- Preserve all desktop Deadline copy and styling.

**Non-Goals:**

- Changing date-picker input labels.
- Replacing `1 day` or `-1 day` with Tomorrow or Yesterday on mobile.
- Changing Deadline urgency color, ordering, icons, or accessibility labels.

## Decisions

### Change the compact formatter at the domain boundary

The compact formatter will special-case an offset of zero before applying the established signed-day output. This keeps all mobile row consumers consistent and leaves the separate desktop relative-date formatter untouched.

Alternative considered: special-case zero directly in the row component. Rejected because copy rules belong in the tested date-formatting domain and duplicating the condition would make future reuse inconsistent.

### Preserve singular grammar for one-day offsets

The existing formatter already emits `1 day` and `-1 day`, with `days` for every other nonzero magnitude. Only its zero result changes.

## Risks / Trade-offs

- [A shared compact formatter change can affect another caller] → Confirm its call sites are limited to mobile task-row Deadline presentation and cover zero, positive one, and negative one in domain and component tests.
- [Desktop copy could regress accidentally] → Keep the desktop formatter and rendering branch unchanged and retain desktop assertions.

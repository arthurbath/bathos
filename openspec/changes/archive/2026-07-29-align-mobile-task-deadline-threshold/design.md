## Context

Task rows already use shared calendar-date helpers for full and compact Deadline copy. The full helper applies a bounded relative window, while the compact helper always returns a signed day count, causing distant mobile deadlines to lose the more legible month-and-day presentation.

## Goals / Non-Goals

**Goals:**

- Give compact and full task-row Deadline copy one inclusive nine-day relative window.
- Preserve compact signed offsets inside that window and short calendar labels outside it.
- Keep owner-local calendar-day arithmetic and existing accessibility labels intact.

**Non-Goals:**

- Change Deadline input copy, urgency color, date storage, sorting, or validation.
- Change any task metadata other than its rendered Deadline label.

## Decisions

- Keep the formatting logic in the existing Tasks date-domain helpers rather than branching in the row component. This keeps responsive variants deterministic and directly testable.
- Pass the locale through the compact helper so distant compact labels use the same `Intl.DateTimeFormat` month-and-day output as full labels.
- Treat offsets from -9 through 9 as nearby. Offsets of -10 and 10 are the first distant values and render as calendar dates.

## Risks / Trade-offs

- [Risk] Locale-dependent month abbreviations can differ from English fixtures. → Keep deterministic unit assertions scoped to `en-US` while production continues to use the user's runtime locale.
- [Risk] Changing the existing full helper from ten days to nine could alter day-10 desktop copy. → This is intentional and matches the explicit more-than-nine-days contract.

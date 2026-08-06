## Context

Tasks already derives one controlling Upcoming date per ordinary task and one projected Start per dated recurrence prototype. The UI groups the next seven dates individually, later dates by month, and eventually by year. Regular tasks and prototypes are merged only after grouping, where a single Upcoming rank currently determines every row's order. Start metadata in month buckets also uses an absolute month-day formatter while Deadline metadata uses the shared relative-date formatter.

## Goals / Non-Goals

**Goals:**

- Give Start and Deadline metadata the same signed nearby-countdown language and the same mobile compression.
- Make every monthly bucket visually chronological across ordinary tasks and recurrence prototypes.
- Preserve manual Upcoming rank as the order among rows that share an effective Start date and as the complete order inside the next seven daily buckets.
- Keep rendered row order and keyboard/selection traversal order identical.

**Non-Goals:**

- Changing Upcoming membership, bucket boundaries, recurrence projection, or stored rank values.
- Reordering year buckets, changing database functions, or migrating production data.
- Removing the established `Today` and `Tomorrow` special labels.

## Decisions

### Reuse the shared relative-date formatters

The desktop formatter will retain `Today`, `Tomorrow`, and the existing nine-day window, but will express other nearby dates as a signed number plus a correctly inflected `day` or `days`. The compact formatter will continue using `Today`, signed `d` offsets, and numeric month-day values outside the window. Start metadata will consume those same two formatters so both temporal concepts follow one threshold.

Alternative considered: create a second Start-specific formatter. This would duplicate rules and allow Start and Deadline output to drift again.

### Apply a date-first comparator only to month sections

When a section is a month bucket, its merged rows will compare their effective Starts first: an ordinary task's controlling Upcoming date or a prototype's scheduled projected Start. Existing Upcoming rank and identity comparison remains the tie-breaker. Day sections retain their current rank-first order. The selection/focus sequence will use the same comparison.

Alternative considered: rewrite stored Upcoming ranks into date order. That would mutate user state unnecessarily and destroy the useful same-date ordering that should remain available when dates change.

## Risks / Trade-offs

- [Risk] Manual dragging can create a stored rank that conflicts with chronological month presentation. -> Keep the rank as a same-date tie-breaker and do not rewrite it; moving a task to a different date changes its chronological group naturally.
- [Risk] Rendered and keyboard order can diverge if only the row renderer changes. -> Route both mixed-row rendering and selectable-row derivation through the same date-first policy.
- [Risk] Existing absolute Start copy tests can mask formatter drift. -> Add direct formatter tests and rendered ordinary-task plus prototype coverage.

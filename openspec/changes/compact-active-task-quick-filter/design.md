## Context

The Tasks list header already keeps the active quick-filter name outside the compact trigger. The remaining radio presets encode overlapping concepts despite actionability having only three values. The saved preference and database-backed widget authority currently use five scalar values, so the interaction can become a multi-select without replacing the durable storage shape.

## Goals / Non-Goals

**Goals:**

- Keep every list-level action in a stable icon-sized footprint.
- Make an active filter apparent both at the control and in the list's identity area.
- Let users include or exclude each actionability state directly.
- Preserve cross-device persistence and native widget behavior for cached clients.

**Non-Goals:**

- Add filtering dimensions beyond actionability.
- Change toolbar actions outside the Tasks primary lists.
- Add responsive-only divergent behavior.

## Decisions

The filter trigger will always use the clear icon-button variant and the same dimensions as the adjacent actions. When active, it will receive the same rounded `info` background and foreground treatment as Select Tasks. This keeps the affordance consistent and avoids layout changes at every viewport width.

The popover will use three shared checkbox menu items in Ready, Rechecking, Waiting order. Selecting all three represents the default `all` value. Attempting to remove the final selection immediately restores all three, so there is no legal empty projection.

The active filter name will render as muted secondary text in the same heading group as the list title. Two-state labels join the checked values with ` & `, one-state labels use that state alone, and the subtitle remains absent when all three are checked.

Persistence will retain the existing scalar values and add only `actionable_waiting` and `actionable_rechecking`. The legacy `non_actionable` value canonically means Waiting plus Rechecking. This seven-value namespace represents every non-empty subset and remains readable by existing clients for all previously supported preferences.

Database widget projections will use one private actionability predicate shared by ordinary tasks and recurrence prototypes. The migration expands the preference constraint, updates the current bounded projection functions, and expands the background snapshot sanitizer without rewriting any owner preference.

The trigger's accessible name will continue to include the active filter name. The visual label moves, but assistive technology retains the current context on the control itself.

## Risks / Trade-offs

- [A subtitle adds height beneath the list title] -> Render it only for proper subsets and use compact secondary typography.
- [Duplicating the active treatment could drift] -> Use the exact class expression already established by Select Tasks and cover both controls in regression tests.
- [A filter name could be mistaken for another heading] -> Keep it visually subordinate and outside the heading element.
- [Cached clients do not know the two new scalar values] -> Existing values remain unchanged, the migration lands before release, and old clients safely fall back to All Tasks if they encounter a new combination.

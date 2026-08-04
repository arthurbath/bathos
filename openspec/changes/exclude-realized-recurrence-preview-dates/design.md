## Context

The repeat editor derives its three preview rows directly from cadence dates. For deadline-driven recurrences it then subtracts the configured lead time to display each generated instance's start date. After today's instance is realized, the cadence generator can still return a deadline whose derived start date is today, so the UI describes an occurrence that is no longer future.

## Goals / Non-Goals

**Goals:**

- Make an existing prototype's “Next” list begin after the current planning date.
- Apply the cutoff to the generated instance start date, including deadline-offset schedules.
- Preserve three preview rows whenever the cadence has three future occurrences.

**Non-Goals:**

- Change recurrence persistence, evaluation, or spawning.
- Rewrite the recurrence cadence generator or alter new-repeat previews before a prototype exists.

## Decisions

- Derive the cadence-date cutoff from the current planning date plus any deadline lead time, then ask the cadence generator for the first three dates strictly after that cutoff. This correctly handles schedules such as “deadline Sunday, start six days earlier” without an arbitrary surplus limit.
- Keep new-repeat previews inclusive of today because they describe the schedule the user is currently creating and no current-day instance has yet been realized.

## Risks / Trade-offs

- [A heavily constrained ending could yield fewer than three future rows] → Display every valid future row returned and do not invent occurrences beyond the cadence.
- [Filtering only the deadline date would retain an already-realized start] → Compare the derived instance start date, not merely the cadence/deadline date.

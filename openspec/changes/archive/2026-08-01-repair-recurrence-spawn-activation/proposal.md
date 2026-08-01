## Why

Calendar recurrence prototypes with a Deadline and an early Start can reach their projected Start date without spawning an ordinary instance. The prototype then remains in a current-day Upcoming bucket because recurrence evaluation compares the cadence Deadline, rather than the earlier spawn date, with the owner's planning date.

## What Changes

- Define the spawn date of a calendar recurrence as its cadence date minus any configured Deadline offset.
- Make owner-local activation generate every due recurrence instance transactionally before ordinary reached-Start activation, then advance the prototype to its next cadence.
- Preserve the cadence date as the generated instance Deadline while persisting the reached projected Start and Today Inbox state.
- Keep authenticated recurrence evaluation bounded by the owner's planning date while evaluating due work by spawn date.
- Repair affected production recurrence definitions idempotently and verify the missing instance and advanced prototype.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Clarify and enforce owner-local calendar recurrence spawning when an early Start reaches today, including background activation and current-day prototype exclusion.

## Impact

- Supabase recurrence evaluation, owner-local activation, cron execution, occurrence instantiation, and production repair data.
- Tasks recurrence hooks and tests that currently compensate by attempting future-date evaluation.
- Upcoming, Today, Anytime, PowerSync, and native widget projections that consume recurrence and ordinary task state.

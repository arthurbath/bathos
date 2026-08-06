## Why

Upcoming task metadata still uses verbose directional countdown copy and does not apply the same relative-date treatment to Start metadata. Monthly Upcoming buckets also merge regular tasks and recurrence prototypes by manual order alone, obscuring the chronological sequence of their explicit or implicit Starts.

## What Changes

- Replace nearby Deadline copy such as `9 days left` and `9 days ago` with signed countdowns such as `9 days` and `-9 days`.
- Apply the same nearby-countdown versus month-and-day presentation to Start metadata in Upcoming month buckets, including compact `d` notation on mobile.
- Order rows within Upcoming month buckets by effective Start date across regular tasks and recurrence prototypes, while retaining the existing manual order as the stable tie-breaker for rows sharing a date.
- Preserve user-defined ordering in the seven daily Upcoming buckets.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine Upcoming date metadata and monthly-bucket ordering behavior.

## Impact

- Tasks date formatting utilities and their unit tests.
- Upcoming regular-task and recurrence-prototype metadata rendering.
- Upcoming combined row ordering and focus order for monthly buckets.
- No database, Supabase, API, dependency, or native-wrapper changes.

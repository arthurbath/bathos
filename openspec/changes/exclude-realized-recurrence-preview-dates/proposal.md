## Why

After a recurrence prototype spawns its current-day instance, the repeat editor can still list that already-realized date as the first of its next three occurrences. That makes the future-looking preview contradict the prototype's advanced position in Upcoming.

## What Changes

- Exclude recurrence preview entries whose generated start date is today or earlier when editing an existing prototype whose current-day spawn has already been realized.
- Continue showing three genuinely future occurrences by advancing the preview far enough to replace excluded entries.
- Cover the post-spawn current-day boundary with regression tests.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Require existing recurrence prototypes to preview only unrealized future spawn dates after today's occurrence has been realized.

## Impact

- Tasks recurrence preview date calculation and repeat-editor rendering.
- Tasks recurrence preview component and domain tests.
- No database, API, migration, native-companion, or dependency changes.

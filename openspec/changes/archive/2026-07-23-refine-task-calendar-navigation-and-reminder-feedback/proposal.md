## Why

The newly refined Tasks calendar can trap keyboard focus when the date above the focused date is disabled, and its inherited DayPicker cursor styling produces unstable pointer feedback. Tasks also exposes reminder metadata that is not useful for this personal workflow and silently rejects invalid reminder entry without enough feedback.

## What Changes

- Make calendar arrow navigation skip disabled dates and reach the calendar header controls when no enabled date remains above.
- Hide unavailable backward month and year navigation without disturbing the centered calendar caption.
- Give enabled and disabled calendar actions stable pointer and not-allowed cursor states.
- Remove repeated-time selection and time-zone display from Tasks reminder editing while retaining deterministic internal reminder resolution.
- Show a brief generic `Not allowed.` toast when reminder shorthand is malformed or resolves to an elapsed Today time.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine the unified Start picker keyboard graph, calendar navigation presentation, and reminder rejection feedback while simplifying reminder editing surfaces.

## Impact

- Shared calendar primitive and keyboard tests under `src/components/ui/`
- Tasks Start picker, project reminder form, editor wiring, and component tests under `src/modules/tasks/`
- No database, RPC, PowerSync, cron, native Apple, or production-data changes

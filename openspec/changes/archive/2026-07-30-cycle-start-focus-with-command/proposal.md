## Why

Control+E currently opens Start but becomes inert once the picker is open. Extending the command into a repeatable focus traversal gives keyboard users a fast way to inspect progressively later Start choices without changing task metadata until they explicitly activate one.

## What Changes

- The first Control+E on Mac, or Alt+Shift+E on Windows, opens Start and focuses the task's current Today horizon or future Start date.
- An unplanned task begins on Today Inbox.
- From any Today horizon, the next invocation advances focus directly to tomorrow rather than cycling through the other horizons.
- Once focus is on a future calendar date, repeated invocations continue advancing one day at a time.
- Crossing a month boundary changes the visible calendar month before focus moves to the first day of the next month.
- Manual arrow navigation to a legal adjacent-month date changes the visible month before focus lands on that date in every shared BathOS date picker.
- Start-command date focus requests remain repeatable after the user moves elsewhere with arrow keys, including when the command returns to the same previously requested date.
- Traversal does not save a Start choice. Enter or Space retains responsibility for activating the focused choice.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Extend the existing Start keyboard command with repeatable, non-committing horizon and calendar focus traversal.
- `form-control-interactions`: Make cross-month arrow navigation page every shared BathOS date picker to the month containing the newly focused legal date.

## Impact

- Tasks module Start-picker keyboard command dispatch and focus behavior.
- Shared Calendar arrow paging, day-button metadata, and repeatable exact-date focus requests.
- Focused Tasks and Calendar tests plus OpenSpec validation.
- No database, Supabase, API, or dependency changes.

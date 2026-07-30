## Why

Reminder entry in the unified Start picker currently requires typed time shorthand even when a whole-hour choice would be faster and more predictable. A keyboard-accessible hour menu can expose only reminder times that are legal for the task's current Start intent while preserving freeform typed entry.

## What Changes

- Compose the Start picker's Reminder field as a shared BathOS input group with an `alarm-clock` action button.
- Add a scrolling, viewport-bounded menu containing every allowable whole-hour reminder time.
- Offer all 24 hours for future Starts and only whole hours strictly later than the current owner-local time for Today or reminder-initiated unplanned tasks.
- Disable the hour-menu button when reminder editing is unavailable or no legal whole-hour option remains.
- Extend the Start picker's spatial keyboard navigation so Right Arrow moves from the input's end to the button, Left Arrow returns to the input, and the menu owns its Enter, Space, arrows, and Escape behavior without committing or closing Start.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Extend unified Start-picker reminder entry with a legal whole-hour menu and complete keyboard traversal.

## Impact

- Tasks module: `TaskStartPicker`, reminder-time domain helpers, and focused interaction tests.
- Shared UI: install the standard shadcn `InputGroup` primitive for the grouped Reminder input and button.
- No Supabase, schema, synchronization, reminder-authority, or migration changes.

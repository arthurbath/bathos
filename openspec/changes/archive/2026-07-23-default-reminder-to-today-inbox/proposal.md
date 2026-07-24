## Why

Tasks currently disables Reminder until a to-do already has a future Start Date or Today horizon. Reminder entry should itself be a valid planning action, so an unplanned to-do can receive a reminder without requiring a separate preliminary Start choice.

## What Changes

- Keep Reminder editable in the Start picker whenever connected reminder storage is available, regardless of the to-do's current Start state.
- When a user saves a reminder on an unplanned to-do, first place the to-do in Today · Inbox, represented by a null future Start Date and the `inbox` day horizon, then save the reminder against the owner's current planning date.
- Preserve an existing future Start Date or Today horizon when changing or adding a reminder.
- Apply the same behavior to a not-yet-persisted new-task draft and retain the reminder until the titled task is created.
- Validate reminder shorthand as a Today reminder when entering it on an unplanned to-do, including rejecting an elapsed time.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Reminder entry in the unified Start picker becomes available before planning and defaults an unplanned to-do to Today · Inbox.

## Impact

- Tasks Start picker enablement and reminder-time validation
- Existing to-do and new-task draft autosave sequencing
- Focused Tasks component regression coverage
- No database migration, public API, dependency, PowerSync, or production topology change

## Why

Repeating task prototypes can be edited from Upcoming but cannot currently be deleted from their ellipsis menu. Users need an explicit Delete action there to retire a repetition without altering ordinary instances it already generated.

## What Changes

- Add Delete to the ellipsis menu for dated and waiting recurrence prototypes in Upcoming.
- Treat prototype deletion as archiving the recurrence definition so it disappears immediately and generates no future instances.
- Preserve already generated ordinary task instances unchanged.
- Report a failed prototype deletion without removing the prototype from the synchronized view.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Extend recurrence prototype management with a recoverable Delete action in the Upcoming ellipsis menu.

## Impact

- Tasks recurrence prototype row actions and Upcoming-list composition.
- Existing recurrence status mutation through `tasks_set_recurrence_status`.
- Focused component tests and the durable Tasks behavior specification.

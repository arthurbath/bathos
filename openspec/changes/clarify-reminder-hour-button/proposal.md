## Why

The Reminder hour action currently resembles a passive field decoration even though it opens a menu. A clearer appended-button treatment will make the interaction discoverable and make the exhausted Today state legibly disabled.

## What Changes

- Add a visible left divider between the Reminder text input and its alarm-clock action.
- Preserve the existing input-group geometry while giving the alarm action distinct enabled and disabled affordances.
- Keep the action disabled when a task has no Start or starts Today and no legal whole-hour option remains.
- Add regression coverage for the enabled and disabled button presentation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Clarify the required visual affordance and disabled presentation of the Start Reminder whole-hour action.

## Impact

- Tasks module Start picker UI and focused tests
- Personal Tasks durable behavior specification
- No database, API, dependency, or cross-module changes

## Why

Task-row metadata competes for limited horizontal space on mobile, leaving less room for the hierarchy label that identifies a task's area or project. The row can remain fully understandable while using established icons and compact signed day counts below the mobile breakpoint.

## What Changes

- Reduce the left inset of active, Done, and Trash task-row headers slightly.
- Show only the Waiting or Rechecking symbol on mobile while preserving the full actionability label on larger viewports and in the accessible name.
- Show mobile deadline offsets as `0 d`, positive future counts such as `4 d`, and negative overdue counts such as `-4 d`.
- Preserve the existing full deadline phrasing on larger viewports and for assistive technology.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine the consistent task-list density requirement with responsive actionability and deadline metadata.

## Impact

- Tasks module only.
- Task-row rendering and calendar-date presentation utilities.
- Focused Tasks component and date-domain tests.
- No database, API, synchronization, or dependency changes.

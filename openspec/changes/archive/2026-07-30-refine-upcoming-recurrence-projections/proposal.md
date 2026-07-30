## Why

Upcoming currently presents generated recurrence schedule projections like ordinary actionable tasks, which implies that they can be completed, moved, or directly rescheduled even though their dates are governed by the recurrence definition. Users need a clear visual and behavioral distinction between a future recurrence projection and the ordinary task instance that becomes actionable when its Start is reached.

## What Changes

- Present generated recurrence projections in Upcoming with the recurrence symbol in place of the task checkbox.
- Prevent direct completion, selection-mode mutation, drag reordering, and direct Start editing of Upcoming recurrence projections.
- Add an Edit Repeat action that creates a new recurrence revision and replaces already-materialized future calendar projections.
- Allow an edited after-completion recurrence to declare the next occurrence date without altering its outstanding task instance.
- Present waiting after-completion recurrences with Waiting in second-row metadata and actions to edit the repeat or go to the outstanding instance.
- Keep reached recurrence instances in Today and Anytime behaving as ordinary task instances without an Edit Repeat action.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine the projection, editing, navigation, and interaction contract for repeating tasks in Upcoming.

## Impact

- Tasks recurrence RPCs, revision validation, and after-completion advancement.
- Recurrence data services and synchronized projection hooks.
- Upcoming task-row rendering, selection, drag behavior, menus, and waiting recurrence rows.
- Tasks recurrence database and application tests.

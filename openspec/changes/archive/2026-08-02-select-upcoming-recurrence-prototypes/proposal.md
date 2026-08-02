## Why

Upcoming recurrence prototypes participate in the same dated ordering surface as ordinary tasks, but the current selection model excludes them. This prevents users from selecting and reordering a mixed group of ordinary tasks and prototypes within an Upcoming day bucket.

## What Changes

- Make dated recurrence prototypes Command-clickable, Control-clickable, Shift-clickable, and directly selectable while task selection mode is active.
- Render the canonical circular selection control and selected-row highlight on selected prototypes, and hide prototype ellipsis controls while selection mode is active.
- Include dated prototypes in Select All and in the selection toolbar count on Upcoming.
- Keep mixed and prototype-only selections editable for the metadata shared by every Upcoming row: Area, Actionability, and Delete. Start and Deadline remain available only when every selected row is an ordinary task.
- Move mixed selected groups of ordinary tasks and dated prototypes together within one Upcoming day bucket while preserving their visible relative order.
- Keep every prototype bound to the date dictated by its recurrence schedule. A drop into another day may move eligible ordinary tasks, but prototypes from other days remain in their schedule-owned buckets.
- Keep the top-right lasso visible in selection mode, expose its active state, and let a second activation cancel selection mode.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Extend task-list selection and Upcoming grouped reordering to dated recurrence prototypes, and make the selection lasso a toggle with an accessible active state.

## Impact

- Tasks selection state, mixed bulk metadata mutations, deletion, and Upcoming drag orchestration in `src/modules/tasks/components/TasksShell.tsx`.
- Dated recurrence prototype row interaction and presentation in `src/modules/tasks/components/TaskRecurrencePrototypeRow.tsx`.
- Task selection and Upcoming reorder regression coverage.
- No database schema, Supabase policy, native companion, or external API change.

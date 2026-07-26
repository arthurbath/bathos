## Why

The mobile Deadline label `0 days` consumes roughly the same width as `Today` while communicating the current date less naturally. Tasks should use the clearer word without changing the compact signed-day convention for past or future deadlines.

## What Changes

- Show `Today` for a task-row Deadline whose owner-planning calendar-day offset is zero at mobile viewport widths.
- Preserve signed numeric mobile labels such as `1 day` and `-1 day`.
- Preserve the established non-mobile relative-date wording, including `Tomorrow` and `Yesterday`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Revise the compact mobile Deadline-copy contract for the zero-day case.

## Impact

- Tasks date-formatting domain helper and tests.
- Tasks collapsed-row rendering tests.
- Personal Tasks module specification only. No database, synchronization, API, or shared-component change.

# Complete Task Picker Keyboard Navigation

## Why

The shared calendar currently leaves two keyboard paths incomplete. Tasks can skip the calendar header when moving down from Today planning controls, and the Deadline calendar can let its underlying date library page to another month when ArrowDown is pressed on the final week instead of moving to Clear. Enter also needs to distinguish internal calendar navigation from a committed Start selection.

## What Changes

- Route downward Start-picker navigation from Today horizons through the calendar header before dates or months.
- Make Enter close Start after a final Today horizon, legal date, or Clear selection while leaving the picker open for month, year, and view navigation.
- Give the shared calendar an explicit downward boundary handoff so Deadline can move from the final calendar row to Clear without changing months.
- Add focused shared-calendar, date-field, and Tasks regression coverage.
- Leave cursor styling unchanged.

## Capabilities

### Modified Capabilities

- `personal-tasks-module`: completes the keyboard focus order and final-selection behavior of the Start and Deadline pickers.

## Impact

- Shared calendar and date-picker keyboard behavior
- Tasks Start-picker keyboard behavior
- Focused component and integration tests
- No database, API, migration, or production-data changes

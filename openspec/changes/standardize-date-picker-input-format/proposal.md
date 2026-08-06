## Why

BathOS date-picker inputs currently render selected dates in several inconsistent month-first formats. Explicit date values should use the user's preferred year-first `YYYY Mon D` format everywhere a date-picker input displays them.

## What Changes

- Standardize explicit selected dates in shared BathOS date-picker inputs as `2026 Aug 7`.
- Apply the same explicit-date format to specialized Tasks start and deadline picker triggers.
- Apply the format to grid-specific date-picker triggers that use the shared calendar with specialized DataGrid behavior.
- Preserve intentional semantic picker labels such as Yesterday, Today, Tomorrow, and Someday.
- Replace the remaining ordinary native date input with the shared BathOS date-picker field so its visible value follows the same contract.
- Leave calendar headings, list metadata, countdowns, previews, and other non-picker date displays unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `form-control-interactions`: Standardize the visible explicit-date format of ordinary shared date-picker inputs.
- `personal-tasks-module`: Standardize explicit dates in the specialized Tasks start and deadline picker inputs while retaining their relative semantic labels.

## Impact

- Shared `DatePickerField` display defaults and tests.
- Ordinary and DataGrid-specific date-picker call sites in Garage, Snake, and other modules.
- Specialized Tasks date-control formatting and tests.
- No database, API, migration, or native-wrapper changes.

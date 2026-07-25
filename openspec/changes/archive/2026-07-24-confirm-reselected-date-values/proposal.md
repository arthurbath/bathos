## Why

BathOS date pickers currently treat activation of an already-selected day as a deselection attempt, which can leave the popover open instead of accepting the user's confirmation. A legal date is a complete final selection whether or not it differs from the previously committed value.

## What Changes

- Make every shared single-date calendar preserve its selected value when that same day is activated again.
- Make pointer, Space, and Return activation of the already-selected legal day follow the ordinary final-selection contract, including closing the owning popover.
- Add shared regression coverage so module-specific date popovers inherit the behavior without one-off fixes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `form-control-interactions`: Clarify that confirming the already-selected legal date is an accepted final selection that closes the date picker.

## Impact

The change affects the shared Calendar primitive and its focused interaction tests. It applies to every BathOS module using the shared single-date calendar, including ordinary date fields, DataGrid date cells, and Tasks planning pickers. It does not change stored date formats, database behavior, or external APIs.

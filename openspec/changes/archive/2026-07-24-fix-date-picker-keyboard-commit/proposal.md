## Why

BathOS date pickers currently allow Space to change a date without closing the popover, and a following Return may still leave the picker open. This creates a provisional-selection state that conflicts with the intended keyboard contract: activating a final date-picker choice should commit it once and close the field layer.

## What Changes

- Make Space and Return equivalent confirmation keys for selectable dates and other final-selection actions inside shared BathOS date pickers.
- Close the date-picker popover immediately after either key successfully commits a final selection.
- Keep calendar paging, caption, month-view, and other navigation-only actions open because they do not represent a final value.
- Apply the same final-selection behavior to Tasks Start, Deadline, and shared date-picker consumers.
- Add focused regression coverage for Space confirmation, Return confirmation after keyboard navigation, non-final calendar navigation, and exactly-once commits.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `form-control-interactions`: Clarify that both Space and Return commit and close a date picker when focus is on a final-selection action.
- `personal-tasks-module`: Make Space and Return equivalent final-confirmation keys for selectable Start dates, Today horizons, and Clear.

## Impact

- Shared Calendar and `DatePickerField` keyboard handling under `src/components/ui/`.
- Tasks-specific Start picker keyboard handling under `src/modules/tasks/components/`.
- Focused shared Calendar, date-picker, and Tasks interaction tests.
- No database, Supabase, PowerSync, Edge Function, migration, or external API changes.

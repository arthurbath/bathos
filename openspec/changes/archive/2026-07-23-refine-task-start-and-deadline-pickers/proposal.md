## Why

The unified Tasks Start picker is functionally complete, but its expanded-editor layout, calendar boundaries, cross-region keyboard navigation, and reminder entry still feel less coherent than BathOS's ordinary date picker. Refining the shared calendar foundation and the Tasks-specific controls will make Start and Deadline compact, predictable, and fully keyboard-first without weakening autosave or reminder integrity.

## What Changes

- Place Start and Deadline together on one responsive editor row with the same right-aligned, muted Lucide calendar icon.
- Move Deadline clearing into its date-picker popover and remove the separate inline clear button.
- Focus and visibly highlight the current Start date when the picker opens, or focus Today Inbox when no Start intent exists.
- Add complete arrow-key movement among Today horizons, calendar navigation and dates, reminder input, ambiguity control, and Clear while retaining Tab and Shift+Tab traversal.
- Make Enter and Space activate focused picker actions, with reminder-input Space preserved for text and a two-step Enter flow that first normalizes a valid typed time and then closes the Start picker.
- Prevent Start calendar and month/year navigation from reaching months with no selectable future date, including opening on the next month when today is the current month's last day.
- Center the shared calendar month picker and visibly distinguish today in both Start and Deadline calendars.
- Replace the native time input with a compact inline text control that accepts a bounded, case-insensitive grammar of reasonable 12-hour, 24-hour, colon, compact, and meridiem forms.
- Silently reject malformed, impossible, or explicitly elapsed Today reminder times; for an ambiguous 1-12 hour on Today, prefer AM while it remains future and otherwise use PM when that is the remaining future interpretation.
- Add deterministic tests for parsing, time-zone-aware Today validation, keyboard movement, month-end boundaries, focus restoration, clearing, and rendered layout.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine the unified Start picker, Deadline picker, reminder text entry, calendar bounds, and keyboard-first editing contract.

## Impact

- **Tasks module:** `TaskStartPicker`, expanded to-do editor layout, reminder input normalization, and associated domain/tests.
- **Shared UI:** `Calendar` gains reusable minimum-date-aware month picker bounds, focus targeting, and centered layout behavior; `DatePickerField` gains optional in-popover clearing.
- **Data and APIs:** No schema, RPC, PowerSync, cron, or reminder persistence contract change. Accepted reminder values continue to reach the existing server contract as canonical 24-hour `HH:mm` intent.
- **Blast radius:** Shared calendar defaults remain unchanged unless a caller supplies the new bounds or focus options. Deadline clearing is opt-in for Tasks.

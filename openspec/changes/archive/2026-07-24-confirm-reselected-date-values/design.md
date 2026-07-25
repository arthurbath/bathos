## Context

BathOS date-popover owners close after their `onSelect` handler receives a legal date. The shared Calendar currently delegates optional single selection to React DayPicker, which treats activating the selected day as a request to clear it and emits no selected date. This prevents owners from distinguishing a valid confirmation from an empty selection and creates inconsistent behavior across ordinary fields, DataGrid cells, and Tasks planning controls.

## Goals / Non-Goals

**Goals:**

- Give every shared single-date Calendar the same confirm-on-reselection behavior.
- Preserve each owner's existing commit, close, and focus-restoration behavior.
- Cover pointer and keyboard activation through the common selection path.

**Non-Goals:**

- Change range or multiple-date selection behavior.
- Remove explicit Clear actions from optional date fields.
- Add module-specific date-picker conditionals or change persisted date values.

## Decisions

The shared Calendar will make single-date selection required at the calendar interaction layer unless a caller explicitly provides a `required` value. React DayPicker then emits the selected date when the current day is activated instead of toggling it off, allowing existing owner handlers to accept the date and close normally.

The Calendar's shared keyboard-capture path will translate Space or Return on a focused day button into one explicit click after suppressing native activation. This makes keyboard and pointer selection converge on the same callback exactly once, including in browser engines or automation surfaces where native keyboard-to-click translation is inconsistent.

This is preferable to modifying every popover owner because the intended behavior is global and new callers should inherit it automatically. Explicit Clear controls remain the sole way to unset an optional date, preserving the distinction between confirming and clearing.

Focused tests will verify the shared field behavior for pointer and Return activation of an already-selected date. A shared Calendar test will verify that the single-selection default cannot deselect the current day while still permitting an explicit caller override.

## Risks / Trade-offs

- [Risk] A caller may have relied on clicking the selected day to clear an optional date. → Mitigation: BathOS date-picker policy already requires explicit Clear actions for null resets, and callers can explicitly override `required` if a future exception is intentional.
- [Risk] Keyboard tests can accidentally synthesize both key and click activation. → Mitigation: Assert exactly one selection callback and use the established test helper pattern for DayPicker activation.

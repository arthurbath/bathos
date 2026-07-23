## 1. Reminder Input Domain

- [x] 1.1 Implement a pure, bounded reminder-time parser with canonical 24-hour and lower-case display output
- [x] 1.2 Implement owner-time-zone-aware Today future-time selection and silent rejection policy
- [x] 1.3 Add table-driven coverage for meridiem, colon, compact, military, ambiguous, malformed, and elapsed forms

## 2. Shared Date-Picker Foundation

- [x] 2.1 Add explicit calendar initial-focus targeting and retain selected/today visual states
- [x] 2.2 Bound shared day, month, and year navigation to an optional earliest selectable date
- [x] 2.3 Center the custom month picker and preserve existing calendar defaults
- [x] 2.4 Add optional in-popover clearing to `DatePickerField` with trigger-focus restoration
- [x] 2.5 Extend shared calendar and date-picker keyboard, month-end, and clearing tests

## 3. Tasks Start And Deadline Experience

- [x] 3.1 Place Start and Deadline in one responsive editor row with matching right-aligned calendar icons
- [x] 3.2 Remove the external Deadline clear button and enable picker-owned clearing
- [x] 3.3 Add cross-region arrow navigation among horizons, calendar, Reminder, ambiguity, and Clear
- [x] 3.4 Replace native reminder time entry with compact inline shorthand input and two-step Enter confirmation
- [x] 3.5 Preserve command focus, autosave ordering, reminder cancellation, and popover focus restoration

## 4. Verification

- [x] 4.1 Add integrated Tasks tests for focus targets, arrow traversal, action activation, reminder normalization, silent rejection, and responsive date layout
- [x] 4.2 Run targeted tests, Tasks typecheck, lint, build, and strict OpenSpec validation
- [x] 4.3 Perform rendered desktop and narrow-mobile QA in the selected browser and record screenshot-grounded evidence
- [x] 4.4 Run the full test suite, sync durable specs, archive the change, commit and push `main`, and prove a clean synchronized repository

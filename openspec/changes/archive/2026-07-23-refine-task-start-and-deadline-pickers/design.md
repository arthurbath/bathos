## Context

The existing release already provides one autosaving Tasks Start picker, a shared `Calendar` with day and month views, and a shared `DatePickerField`. The expanded to-do editor currently places Start and Deadline on separate rows, shows Start's calendar icon on the left, and renders Deadline clearing as a separate X button. Start uses a native time input, which cannot accept the user's shorthand grammar or implement the requested two-step Enter behavior.

The shared calendar already supports internal arrow navigation, an opt-in Tab exit, a custom month picker, and selected/today styling. It does not expose a bounded earliest month to its custom month view, does not intentionally transfer arrow focus to Tasks-specific controls outside the calendar, and relies on generic initial-focus behavior rather than a caller-selected target.

## Goals / Non-Goals

**Goals:**

- Make Start and Deadline read as a matched pair of date controls in one responsive editor row.
- Preserve immediate autosave while moving Deadline clearing into its popover.
- Make the Start picker continuously keyboard-navigable across its Today, calendar, reminder, ambiguity, and Clear regions.
- Bound Start navigation to months containing at least one selectable future date.
- Parse reasonable reminder shorthand deterministically and enforce owner-local future-time rules for Today reminders.
- Keep shared calendar changes opt-in or generally correct for existing callers.

**Non-Goals:**

- No database, RPC, PowerSync, cron, reminder-delivery, or native Apple change.
- No typed date entry for Start or Deadline.
- No deadline-time reminders or independently selected reminder dates.
- No redesign of project planning controls in this change.
- No natural-language parser for phrases such as “after lunch” or “tomorrow morning.”

## Decisions

### Keep shared calendar mechanics shared and picker choreography local

`Calendar` will own generally reusable behavior: explicit initial-focus date, lower navigation bound, disabled months and years, selected/today styling, and centered month-grid layout. `TaskStartPicker` will own cross-region focus choreography because Today horizons, reminder entry, and Clear are Tasks concepts.

This avoids importing Tasks concepts into shared UI while preventing a second calendar implementation.

### Define the Start calendar lower bound as tomorrow

The earliest selectable Start date remains the day after the owner's planning date. That date also becomes the earliest navigable calendar month. On the final day of a month, tomorrow belongs to the next month, so an unplanned picker opens there and the elapsed current month is unavailable in both day and month views.

The custom month picker receives the earliest selectable date, disables every month whose final calendar day precedes it, and disables backward year paging when the preceding year contains no selectable month.

### Treat focus as an explicit ordered graph

The picker will expose stable data hooks for Today horizons, calendar controls, reminder input, ambiguity selection, and Clear. Tab and Shift+Tab keep DOM order. Arrow behavior supplements that order:

- Left and Right move among Today horizons and within existing calendar/month grids.
- Down from a Today horizon enters the selected date or first enabled date.
- Up from the calendar header exits to the corresponding or selected Today horizon.
- Down from the calendar's final enabled row enters Reminder.
- Up and Down move among Reminder, the optional ambiguity control, and Clear.
- Escape closes the surface and restores the trigger.

Native Enter and Space activation remains authoritative for buttons and calendar dates. Space remains ordinary text inside Reminder. Enter inside Reminder is handled separately.

### Use one pure reminder parser and a separate Today policy

A Tasks domain helper will normalize trimmed, case-insensitive input and return canonical 24-hour `HH:mm` plus whether the interpretation was meridiem-explicit, 24-hour-explicit, or ambiguous.

Accepted forms are composed only from digits, one optional colon, spaces around an optional `a`, `am`, `p`, or `pm` suffix, and the following shapes:

- one or two hour digits, such as `1`, `11`, `13`, `1p`, or `1 pm`;
- hour and one or two minute digits, such as `1:3p`, `1:30 pm`, or `13:30`;
- three or four compact digits, such as `130`, `930p`, or `1300`.

A one-digit minute means tens of minutes, so `1:3p` becomes `13:30`. A suffix requires a 1-12 hour. Unsuffixed values from 13 through 23 are 24-hour times. Unsuffixed one- or two-digit values from 1 through 12 are ambiguous and default to AM except for Today policy. Three unsuffixed digits are 12-hour compact AM intent; four unsuffixed digits are 24-hour intent. Impossible hours or minutes, unsupported characters, duplicate markers, and values such as `25` or `asdf` return no interpretation.

For a future Start date, every valid interpretation is accepted. For a Today horizon, explicit AM/PM and 24-hour interpretations are rejected when their resolved minute is not later than the current owner-local time. An ambiguous 1-12-hour interpretation uses AM when still future, otherwise PM when still future, otherwise rejects. Current owner-local time is derived from the planning time zone rather than the browser's local zone.

### Make Reminder a committed-value editor

The text input displays a lower-case 12-hour value, while persistence continues using canonical 24-hour `HH:mm`.

- Blur attempts normalization and save.
- First Enter on a valid raw or changed value normalizes, saves, displays the formatted value, and keeps the picker open.
- Enter on an already normalized committed value closes the picker.
- Invalid or elapsed input silently restores the last committed display value and performs no mutation.
- Empty input cancels an existing reminder through the current contract.

This makes rejection visible through non-commitment without adding error copy, while preserving autosave and the requested confirmation step.

### Add opt-in clearing to `DatePickerField`

`DatePickerField` gains optional Clear content inside its popover. Tasks Deadline enables it and removes the neighboring X button. The clear action emits an empty value, closes the popover, and restores trigger focus. Existing callers are unchanged.

### Preserve visual vocabulary

Both editor triggers use the same right-aligned, muted Lucide `CalendarIcon`. Today remains styled through the shared calendar's semantic accent state, selected dates retain the stronger primary state, and a date that is both today and selected remains distinguishable by its selected state and accessible label.

## Risks / Trade-offs

- **[Risk] Custom arrow handling can conflict with browser or DayPicker behavior.** → Handle only documented boundary transfers, preserve internal calendar navigation, and add event-level regression tests for default prevention and focus.
- **[Risk] Time shorthand can become unpredictable if the grammar grows informally.** → Keep parsing pure, bounded, table-tested, and independent from time-zone policy.
- **[Risk] Owner-local current-time checks can become flaky.** → Inject the current instant into the policy helper and test exact planning-zone boundaries.
- **[Risk] Shared calendar bounds could regress unrelated date pickers.** → Make lower bounds and initial-focus targeting prop-driven, retain existing defaults, and run the full shared-calendar and application suites.
- **[Risk] Immediate reminder saves can race with planning changes.** → Continue using the editor's existing ordered autosave queue and authoritative reminder service.

## Migration Plan

1. Add pure parser and calendar-boundary tests before wiring UI behavior.
2. Extend shared calendar and date-picker primitives with backward-compatible props.
3. Update the Tasks editor and Start panel, then add integrated keyboard and reminder tests.
4. Perform desktop and narrow-mobile rendered QA in the user's selected browser.
5. Run full tests, typecheck, lint, build, and strict OpenSpec validation.

Rollback is a source-only web rollback to the prior Tasks bundle. No production data or database rollback is required.

## Open Questions

None. The malformed example `1:30 pm ⇒ 1:30 pp` is treated as an obvious dictation typo and normalized to `1:30 pm`.

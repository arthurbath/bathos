## ADDED Requirements

### Requirement: Compact Task Date Controls
The Tasks expanded to-do editor SHALL present Start and Deadline as a matched responsive pair of date controls while retaining their independent autosave semantics.

#### Scenario: Present Start and Deadline together
- **WHEN** a to-do editor has enough horizontal space for two temporal controls
- **THEN** Start and Deadline appear on the same row with equal-width triggers and the same muted right-aligned calendar symbol

#### Scenario: Adapt the date controls to narrow width
- **WHEN** the editor cannot preserve usable trigger widths in two columns
- **THEN** Start and Deadline stack without horizontal overflow or clipped labels

#### Scenario: Clear Deadline inside its picker
- **WHEN** a to-do has a Deadline and the user activates Clear inside the Deadline picker
- **THEN** Tasks immediately persists a null Deadline, closes the picker, restores trigger focus, and exposes no separate inline clear button

#### Scenario: Identify today in either calendar
- **WHEN** the owner planning date is visible in the Start or Deadline calendar
- **THEN** the calendar gives today a visible semantic highlight and an accessible current-date state independently from the selected-date state

### Requirement: Flexible Reminder Time Entry
The Tasks Start picker SHALL accept a bounded grammar of reasonable time shorthand, normalize accepted input to one visible local time, and persist only canonical 24-hour reminder intent.

#### Scenario: Normalize meridiem shorthand
- **WHEN** a user enters `1p`, `1pm`, `1 pm`, `1:3p`, `1:30p`, `1:30pm`, `1:30 pm`, or `130p`
- **THEN** Tasks interprets the value as 1:00 pm or 1:30 pm as applicable, displays the normalized lower-case meridiem time, and persists `13:00` or `13:30`

#### Scenario: Normalize numeric shorthand
- **WHEN** a user enters `1`, `13`, `130`, or `1300` for future work
- **THEN** Tasks interprets the values as 1:00 am, 1:00 pm, 1:30 am, and 1:00 pm respectively

#### Scenario: Reject malformed reminder input silently
- **WHEN** a user commits an impossible or unsupported value such as `25` or `asdf`
- **THEN** Tasks performs no reminder mutation, restores the last committed display value, and shows no validation message

#### Scenario: Reject an explicit elapsed Today time
- **WHEN** a Today reminder entry explicitly resolves to an owner-local instant that is not later than the current time
- **THEN** Tasks performs no reminder mutation and restores the last committed display value

#### Scenario: Resolve ambiguous Today shorthand to the remaining future meridiem
- **WHEN** an unsuffixed 1-12-hour reminder value has an elapsed AM interpretation but a future PM interpretation on the owner planning date
- **THEN** Tasks uses the PM interpretation and persists its canonical 24-hour time

#### Scenario: Reject fully elapsed ambiguous Today shorthand
- **WHEN** both AM and PM interpretations of an unsuffixed 1-12-hour value have elapsed on the owner planning date
- **THEN** Tasks performs no reminder mutation and restores the last committed display value

#### Scenario: Accept any valid time for future work
- **WHEN** a reminder belongs to a future Start date
- **THEN** Tasks accepts every valid parser interpretation regardless of the current owner-local time

#### Scenario: Confirm reminder input in two Enter steps
- **WHEN** a user presses Enter while Reminder contains a valid raw or changed value
- **THEN** Tasks normalizes and saves the value, keeps the Start picker open, and lets the next Enter on the unchanged normalized value close the picker

#### Scenario: Preserve spaces in reminder input
- **WHEN** focus is inside Reminder and the user presses Space
- **THEN** the input receives a space rather than activating or closing the Start picker

#### Scenario: Keep Reminder compact
- **WHEN** the Start picker renders Reminder
- **THEN** its label and text input share one line and the input uses only the width needed for a time value

## MODIFIED Requirements

### Requirement: Unified Task Start Picker
The Tasks interface SHALL present a single autosaving Start control for Today horizon, future deferral date, and reminder intent by composing the established BathOS popover and calendar primitives with Tasks-specific controls.

#### Scenario: Open the complete Start picker
- **WHEN** a user activates Start from an open to-do or its action menu
- **THEN** one BathOS popover presents Inbox, Now, Next, and Later Today horizons, a calendar, inline reminder time, and Clear without separate Start Date, Day Horizon, or Reminder Time editor fields

#### Scenario: Focus the current Start intent
- **WHEN** Start opens for a task with a future Start Date
- **THEN** the selected date is visibly highlighted, receives keyboard focus, and remains visible in its calendar month

#### Scenario: Focus an unplanned Start picker
- **WHEN** Start opens for a task with neither a future Start Date nor a Today horizon
- **THEN** keyboard focus lands on Today Inbox

#### Scenario: Choose a Today horizon
- **WHEN** a user chooses Inbox, Now, Next, or Later in the Start picker
- **THEN** Tasks immediately stores that active Today horizon with a null future Start Date and keeps the picker available for optional reminder editing

#### Scenario: Choose a future Start date
- **WHEN** a user chooses a date after the owner's planning date
- **THEN** Tasks immediately stores that future Start Date, retains a valid selected day horizon for reached-date activation, and keeps the picker available for optional reminder editing

#### Scenario: Prevent calendar scheduling for today or the past
- **WHEN** the Start picker calendar displays the owner planning date or an earlier date
- **THEN** those date buttons are disabled because Today placement is selected through an explicit day horizon

#### Scenario: Bound Start calendar navigation
- **WHEN** the user pages the Start calendar or opens its month picker
- **THEN** months with no selectable date after the owner planning date are unavailable through month navigation, year navigation, pointer selection, and keyboard selection

#### Scenario: Open on the earliest usable month
- **WHEN** a task has no future Start Date and the owner planning date is the final day of its month
- **THEN** the Start calendar opens on the following month because the current month contains no selectable Start date

#### Scenario: Center the month picker
- **WHEN** the user opens the shared month-selection view from Start
- **THEN** the year heading, navigation, and month grid are horizontally centered within the same viewport as the day calendar

#### Scenario: Add or clear a reminder inside Start
- **WHEN** a task has a Today horizon or future Start Date and the user enters or clears a reminder time
- **THEN** Tasks immediately saves or cancels the one dependent reminder through the authoritative reminder contract without requesting an independent reminder date

#### Scenario: Clear Start
- **WHEN** the user activates Clear in the Start picker
- **THEN** Tasks immediately clears both future Start Date and Today horizon, cancels any active reminder and pending occurrence, and treats keyboard activation as a committed final action

#### Scenario: Traverse the complete picker with Tab
- **WHEN** focus enters the Start picker
- **THEN** Tab and Shift+Tab traverse its horizon, calendar, reminder, optional ambiguity, and Clear controls, Escape closes the popover, and close restores focus to the trigger

#### Scenario: Traverse the complete picker with arrow keys
- **WHEN** focus is within Start and the user presses an arrow key outside ordinary reminder text editing
- **THEN** focus moves predictably among Today horizons, calendar header and dates, Reminder, optional ambiguity, and Clear while skipping disabled destinations

#### Scenario: Activate a focused Start action
- **WHEN** a user presses Enter or Space on a focused Today horizon, calendar action, selectable date, month, year pager, or Clear
- **THEN** Tasks performs the same action as pointer activation, while Space inside Reminder remains text input

#### Scenario: Open Start from the reminder command
- **WHEN** Command+E on Mac or Control+E on Windows targets one open to-do or one or more selected to-dos
- **THEN** Tasks opens the Start surface for an eligible single target with reminder time prefocused, or opens the existing multi-task reminder surface for eligible bulk work, and suppresses the matching browser command

#### Scenario: Withhold a reminder from unplanned work
- **WHEN** a task has neither a Today horizon nor a future Start Date
- **THEN** the reminder time control remains visible for discovery but disabled until the user chooses a Start intent

## MODIFIED Requirements

### Requirement: Flexible Reminder Time Entry
The Tasks Start picker SHALL accept a bounded grammar of reasonable time shorthand, normalize accepted input to one visible local time, persist only canonical 24-hour reminder intent, and provide concise rejection feedback without exposing resolution metadata.

#### Scenario: Normalize meridiem shorthand
- **WHEN** a user enters `1p`, `1pm`, `1 pm`, `1:3p`, `1:30p`, `1:30pm`, `1:30 pm`, or `130p`
- **THEN** Tasks interprets the value as 1:00 pm or 1:30 pm as applicable, displays the normalized lower-case meridiem time, and persists `13:00` or `13:30`

#### Scenario: Normalize numeric shorthand
- **WHEN** a user enters `1`, `13`, `130`, or `1300` for future work
- **THEN** Tasks interprets the values as 1:00 am, 1:00 pm, 1:30 am, and 1:00 pm respectively

#### Scenario: Reject malformed reminder input
- **WHEN** a user commits an impossible or unsupported value such as `25` or `asdf`
- **THEN** Tasks performs no reminder mutation, restores the last committed display value, retains the active reminder surface, and briefly shows `Not allowed.`

#### Scenario: Reject an explicit elapsed Today time
- **WHEN** a Today reminder entry explicitly resolves to an owner-local instant that is not later than the current time
- **THEN** Tasks performs no reminder mutation, restores the last committed display value, and briefly shows `Not allowed.`

#### Scenario: Resolve ambiguous Today shorthand to the remaining future meridiem
- **WHEN** an unsuffixed 1-12-hour reminder value has an elapsed AM interpretation but a future PM interpretation on the owner planning date
- **THEN** Tasks uses the PM interpretation and persists its canonical 24-hour time

#### Scenario: Reject fully elapsed ambiguous Today shorthand
- **WHEN** both AM and PM interpretations of an unsuffixed 1-12-hour value have elapsed on the owner planning date
- **THEN** Tasks performs no reminder mutation, restores the last committed display value, and briefly shows `Not allowed.`

#### Scenario: Accept any valid time for future work
- **WHEN** a reminder belongs to a future Start date
- **THEN** Tasks accepts every valid parser interpretation regardless of the current owner-local time

#### Scenario: Confirm reminder input in two Enter steps
- **WHEN** a user presses Enter while a Start-picker Reminder input contains a valid raw or changed value
- **THEN** Tasks normalizes the visible value and keeps Start open, then the next Enter on the unchanged normalized value closes Start

#### Scenario: Preserve spaces in reminder input
- **WHEN** focus is inside Reminder and the user presses Space
- **THEN** the input receives a space rather than activating or closing Start

#### Scenario: Size Reminder for its surface
- **WHEN** the Start picker renders Reminder
- **THEN** its text input uses the ordinary text-field style and fills the available picker row

### Requirement: Unified Task Start Picker
The Tasks interface SHALL present a single autosaving Start control for Today horizon, future deferral date, and reminder intent by composing the established BathOS popover and calendar primitives with Tasks-specific controls. Activating a final Start selection by pointer, Space, or Return SHALL persist that selection and close the picker.

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
- **WHEN** a user activates Inbox, Now, Next, or Later with pointer input, Space, or Return
- **THEN** Tasks stores that active Today horizon with a null future Start Date exactly once, closes Start after autosave succeeds, and restores focus to the trigger

#### Scenario: Choose a future Start date
- **WHEN** a user activates a legal date after the owner's planning date with pointer input, Space, or Return
- **THEN** Tasks stores that future Start Date with a null Today horizon exactly once, closes Start after autosave succeeds, and restores focus to the trigger

#### Scenario: Prevent calendar scheduling for today or the past
- **WHEN** the Start picker calendar displays the owner planning date or an earlier date
- **THEN** those date buttons are disabled because Today placement is selected through an explicit day horizon

#### Scenario: Bound Start calendar navigation
- **WHEN** the user pages the Start calendar or opens its month picker
- **THEN** months with no selectable date after the owner planning date are unavailable through month navigation, year navigation, pointer selection, and keyboard selection

#### Scenario: Escape a disabled date boundary
- **WHEN** a focused selectable date has one or more disabled dates above it and the user presses ArrowUp
- **THEN** focus skips the disabled dates, reaches an enabled date when one exists above, or reaches the appropriate calendar header control when none exists

#### Scenario: Hide unavailable backward navigation
- **WHEN** no earlier calendar month or month-picker year contains an allowed Start date
- **THEN** the corresponding backward navigation symbol is not visible and the month or year caption remains horizontally centered

#### Scenario: Preserve calendar cursor meaning
- **WHEN** a pointer rests or moves over a calendar date, month, caption, or paging action
- **THEN** every enabled action consistently uses a pointer cursor and every disabled action consistently uses a not-allowed cursor without settling to the default cursor

#### Scenario: Open on the earliest usable month
- **WHEN** a task has no future Start Date and the owner planning date is the final day of its month
- **THEN** the Start calendar opens on the following month because the current month contains no selectable Start date

#### Scenario: Center the month picker
- **WHEN** the user opens the shared month-selection view from Start
- **THEN** the year heading, navigation, and month grid are horizontally centered within the same viewport as the day calendar

#### Scenario: Add or clear a reminder inside Start
- **WHEN** connected reminder storage is available and a user enters or clears a reminder time for a present open to-do
- **THEN** Tasks immediately saves or cancels the one dependent reminder through the authoritative reminder contract, first assigning Today · Inbox when the to-do has no Start intent and never requesting an independent reminder date

#### Scenario: Clear Start
- **WHEN** the user activates Clear with pointer input, Space, or Return
- **THEN** Tasks immediately clears both future Start Date and Today horizon, cancels any active reminder and pending occurrence, closes Start after autosave succeeds, and commits the action exactly once

#### Scenario: Leave Start with Tab
- **WHEN** focus is anywhere inside Start and the user presses Tab or Shift+Tab
- **THEN** Tasks closes Start without selecting a merely focused date, restores the committed task state, and moves focus to the next or previous control in the containing task editor rather than traversing Start's internal controls

#### Scenario: Traverse the complete picker with arrow keys
- **WHEN** focus is within Start and the user presses an arrow key outside ordinary reminder text editing
- **THEN** downward focus moves in visible order from Today horizons to the calendar header, then to enabled dates or months, Reminder, and Clear while reverse navigation follows the same structure and skips disabled destinations

#### Scenario: Keep Start open for internal calendar navigation
- **WHEN** keyboard focus is on a calendar pager, month or year caption, or selectable month and the user activates it with Space or Return
- **THEN** Tasks performs the calendar page or view action and keeps Start open with focus inside the picker

#### Scenario: Preserve Reminder text entry
- **WHEN** keyboard focus is in Reminder and the user enters Space or other text
- **THEN** Tasks treats it as reminder input rather than a Start-selection command

#### Scenario: Cancel Start without closing the task
- **WHEN** a user presses unmodified Escape inside Start
- **THEN** Tasks closes Start, restores its trigger focus and pre-open provisional field state, and leaves the containing task editor open

#### Scenario: Open Start from the reminder command
- **WHEN** Control+B on Mac or Alt+Shift+B on Windows targets one open to-do outside selection mode
- **THEN** Tasks opens Start with Reminder prefocused and suppresses the matching browser command

#### Scenario: Ignore the reminder command in selection mode
- **WHEN** selection mode is active and the user presses Control+B on Mac or Alt+Shift+B on Windows with zero, one, or many selected to-dos
- **THEN** Tasks suppresses the matching browser command without opening a reminder surface, changing selection membership, or mutating any task or reminder

#### Scenario: Keep Reminder available before planning
- **WHEN** a task has neither a Today horizon nor a future Start Date
- **THEN** the reminder time control remains visible and editable whenever connected reminder storage is available

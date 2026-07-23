## MODIFIED Requirements

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

#### Scenario: Leave the Deadline calendar through its lower boundary
- **WHEN** keyboard focus is on the final visible row of the Deadline calendar and the user presses ArrowDown
- **THEN** focus moves to Clear and the visible calendar month does not change

#### Scenario: Identify today in either calendar
- **WHEN** the owner planning date is visible in the Start or Deadline calendar
- **THEN** the calendar gives today a visible semantic highlight and an accessible current-date state independently from the selected-date state

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
- **THEN** Tasks immediately stores that active Today horizon with a null future Start Date and keeps the picker available for optional reminder editing unless Enter confirmed the final selection

#### Scenario: Choose a future Start date
- **WHEN** a user chooses a date after the owner's planning date
- **THEN** Tasks immediately stores that future Start Date, retains a valid selected day horizon for reached-date activation, and keeps the picker available for optional reminder editing unless Enter confirmed the final selection

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
- **WHEN** a task has a Today horizon or future Start Date and the user enters or clears a reminder time
- **THEN** Tasks immediately saves or cancels the one dependent reminder through the authoritative reminder contract without requesting an independent reminder date

#### Scenario: Clear Start
- **WHEN** the user activates Clear in the Start picker
- **THEN** Tasks immediately clears both future Start Date and Today horizon, cancels any active reminder and pending occurrence, and treats keyboard activation as a committed final action

#### Scenario: Traverse the complete picker with Tab
- **WHEN** focus enters the Start picker
- **THEN** Tab and Shift+Tab traverse its horizon, calendar, reminder, and Clear controls, Escape closes the popover, and close restores focus to the trigger

#### Scenario: Traverse the complete picker with arrow keys
- **WHEN** focus is within Start and the user presses an arrow key outside ordinary reminder text editing
- **THEN** downward focus moves in visible order from Today horizons to the calendar header, then to enabled dates or months, Reminder, and Clear while reverse navigation follows the same structure and skips disabled destinations

#### Scenario: Confirm a final Start selection with Enter
- **WHEN** keyboard focus is on a Today horizon, selectable date, or Clear and the user presses Enter
- **THEN** Tasks performs the selection once, waits for its immediate autosave, closes Start, and restores focus to the trigger

#### Scenario: Keep Start open for internal calendar navigation
- **WHEN** keyboard focus is on a calendar pager, month or year caption, or selectable month and the user presses Enter
- **THEN** Tasks performs the calendar page or view action and keeps Start open with focus inside the picker

#### Scenario: Activate other focused Start actions
- **WHEN** a user presses Space on a focused Today horizon, calendar action, selectable date, month, year pager, or Clear
- **THEN** Tasks performs the same action as pointer activation, while Space inside Reminder remains text input

#### Scenario: Open Start from the reminder command
- **WHEN** Command+E on Mac or Control+E on Windows targets one open to-do or one or more selected to-dos
- **THEN** Tasks opens the Start surface for an eligible single target with reminder time prefocused, or opens the existing multi-task reminder surface for eligible bulk work, and suppresses the matching browser command

#### Scenario: Withhold a reminder from unplanned work
- **WHEN** a task has neither a Today horizon nor a future Start Date
- **THEN** the reminder time control remains visible for discovery but disabled until the user chooses a Start intent

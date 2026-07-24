## ADDED Requirements

### Requirement: Shared Task Editor Form Commands
The Tasks expanded to-do editor SHALL act as an autosaving form scope under the shared BathOS form-control interaction contract. Form submit and form cancel SHALL both flush pending valid autosave and close the editor because accepted task changes cannot be canceled retroactively.

#### Scenario: Close a task with the form-submit command
- **WHEN** a task editor is open and the user presses Command+Return on Mac or Control+Return on Windows outside active composition
- **THEN** Tasks suppresses the matching browser action, flushes pending autosave, closes the editor from any focused task field, and commits deferred completion through the ordinary close path

#### Scenario: Close a task with the form-cancel command
- **WHEN** a task editor is open and the user presses Command+Escape on Mac or Control+Shift+X on Windows outside active composition
- **THEN** Tasks suppresses the matching browser action, flushes pending autosave, closes the editor from any focused task field, and commits deferred completion without claiming to revert accepted edits

#### Scenario: Keep plain Escape field-local
- **WHEN** a task editor is open and the user presses unmodified Escape
- **THEN** the deepest open task field layer may cancel or revert itself, but the task editor remains open when no field layer owns Escape

#### Scenario: Discard an untitled task draft on form close
- **WHEN** either task form command closes a draft whose title never became nonblank
- **THEN** Tasks removes the local draft without creating synchronized work, history, sources, reminders, or a success toast

#### Scenario: Present the revised close commands
- **WHEN** the user opens the Tasks keyboard-command reference
- **THEN** the close action shows Command+Return or Command+Escape on Mac and Control+Return or Control+Shift+X on Windows, and it no longer presents plain Escape as a task-editor close command

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
- **THEN** Tasks immediately stores that active Today horizon with a null future Start Date and keeps the picker available for optional reminder editing unless Return confirmed the final selection

#### Scenario: Choose a future Start date
- **WHEN** a user chooses a date after the owner's planning date
- **THEN** Tasks immediately stores that future Start Date, retains a valid selected day horizon for reached-date activation, and keeps the picker available for optional reminder editing unless Return confirmed the final selection

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
- **WHEN** the user activates Clear in the Start picker
- **THEN** Tasks immediately clears both future Start Date and Today horizon, cancels any active reminder and pending occurrence, and treats keyboard activation as a committed final action

#### Scenario: Leave Start with Tab
- **WHEN** focus is anywhere inside Start and the user presses Tab or Shift+Tab
- **THEN** Tasks closes Start without selecting a merely focused date, restores the committed task state, and moves focus to the next or previous control in the containing task editor rather than traversing Start's internal controls

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

#### Scenario: Cancel Start without closing the task
- **WHEN** a user presses unmodified Escape inside Start
- **THEN** Tasks closes Start, restores its trigger focus and pre-open provisional field state, and leaves the containing task editor open

#### Scenario: Open Start from the reminder command
- **WHEN** Command+E on Mac or Control+E on Windows targets one open to-do or one or more selected to-dos
- **THEN** Tasks opens the Start surface for an eligible single target with reminder time prefocused, or opens the existing multi-task reminder surface for eligible bulk work, and suppresses the matching browser command

#### Scenario: Keep Reminder available before planning
- **WHEN** a task has neither a Today horizon nor a future Start Date
- **THEN** the reminder time control remains visible and editable whenever connected reminder storage is available

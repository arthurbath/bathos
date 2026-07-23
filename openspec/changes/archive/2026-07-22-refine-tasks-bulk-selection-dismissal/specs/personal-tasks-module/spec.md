## MODIFIED Requirements

### Requirement: Bulk Task Planning
The system SHALL provide an accessible task-row selection mode for open tasks, SHALL treat selection as a temporary context bounded by to-do rows, and SHALL apply supported day-horizon, future scheduling, Anytime, or Someday actions to selected records as one local transaction.

#### Scenario: Enter selection with the platform modifier
- **WHEN** a user Command-clicks a visible task on Mac or Control-clicks a visible task on Windows while selection is inactive
- **THEN** the interface enters selection, makes that task the stable range anchor, selects it, reports the selected count, and does not open its editor

#### Scenario: Select a contiguous anchored range
- **WHEN** a user Shift-clicks a visible task after establishing a selection anchor
- **THEN** the interface replaces the prior range with the contiguous visible range between the original anchor and the clicked task without moving the anchor

#### Scenario: Replace an anchored range repeatedly
- **WHEN** a user Shift-clicks a different visible task while selection remains active
- **THEN** the interface replaces the previous range with the new contiguous range from the original anchor

#### Scenario: Toggle selection after entry
- **WHEN** selection is active and a user ordinarily clicks, Command-clicks on Mac, or Control-clicks on Windows on a visible task
- **THEN** the interface toggles that task's selected state without opening its editor

#### Scenario: Preserve ordinary task expansion
- **WHEN** selection is inactive and a user ordinarily clicks a task
- **THEN** the interface opens or closes that task's editor exactly as before

#### Scenario: Operate selection accessibly
- **WHEN** one or more visible tasks are selected in Today, Upcoming, Anytime, or Someday
- **THEN** the interface reports the selected count, exposes Select All and Clear, and communicates each selected state to keyboard and assistive-technology users without requiring a persistent header selection button

#### Scenario: Select every visible to-do by keyboard
- **WHEN** focus is not owned by an editable control and a user presses Command+A on Mac or Control+A on Windows in Today, Upcoming, Anytime, or Someday
- **THEN** the interface suppresses the matching browser command, enters selection when necessary, and selects every to-do in the active view without selecting projects or other non-to-do content

#### Scenario: Preserve native text selection
- **WHEN** an editable input, textarea, select, or contenteditable region owns Command+A on Mac or Control+A on Windows
- **THEN** the interface leaves the gesture available to that editable control and does not change bulk selection

#### Scenario: Dismiss selection outside a to-do
- **WHEN** bulk selection is active and the user presses the pointer outside every to-do row and outside the controls that operate the active selection
- **THEN** the interface clears the selection and range anchor and returns to ordinary task interaction

#### Scenario: Retain selection for owned interactions
- **WHEN** bulk selection is active and the user interacts with a title or other control inside a to-do row, the bulk toolbar, or its planning dialog
- **THEN** the interface leaves selection active until the owned interaction applies its existing selection or planning behavior

#### Scenario: Plan selected tasks
- **WHEN** a user applies Today Inbox, Today Now, Today Next, Today Later, Remove from Today, Tomorrow, Anytime, or Someday to selected tasks
- **THEN** the system updates every selected task's destination, start date, selected day horizon, dependent reminder, mutation metadata, revision, and relevant order in one local transaction while preserving selected order

#### Scenario: Preserve a bulk horizon while scheduling
- **WHEN** a user applies a future date to selected tasks with an Inbox, Now, Next, or Later horizon
- **THEN** the system retains the requested horizon for every valid selected task while the tasks remain in Upcoming

#### Scenario: Allow deliberately overdue bulk work
- **WHEN** a requested start date is later than one or more selected deadlines
- **THEN** the system retains those deadlines and accepts the schedule when every selected record is otherwise valid

#### Scenario: Reject one invalid bulk member
- **WHEN** any selected task is no longer open and present
- **THEN** the system rejects the operation without writing any selected task and leaves selection available for correction or retry

#### Scenario: Keep bulk scope bounded
- **WHEN** the user exits selection, changes views, or completes a successful bulk plan
- **THEN** the client clears selection and its range anchor and returns to ordinary editing without adding bulk completion, deletion, or hierarchy mutation

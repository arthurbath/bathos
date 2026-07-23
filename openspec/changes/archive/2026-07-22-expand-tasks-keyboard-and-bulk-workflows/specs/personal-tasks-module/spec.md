## MODIFIED Requirements

### Requirement: Bulk Task Planning
The system SHALL provide an accessible task-row selection mode for open tasks, SHALL expose its controls as a fixed bottom overlay that does not move list content, and SHALL apply supported planning and organization actions to selected records.

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
- **THEN** the fixed bottom selection overlay reports the selected count, exposes Select All and Select None, and communicates each selected state to keyboard and assistive-technology users without shifting list content

#### Scenario: Preserve access to the final task
- **WHEN** the fixed selection overlay is visible above the list
- **THEN** the list retains enough bottom scroll space for its final task and controls to move fully above the overlay

#### Scenario: Exit selection directly
- **WHEN** a user presses Escape, activates Done, changes views, or clicks outside a to-do and outside a selection-owned surface
- **THEN** the client clears selection and its stable range anchor and returns to ordinary editing

#### Scenario: Plan selected tasks
- **WHEN** a user applies Today Now, Today Next, Today Later, Remove from Today, a future Start Date, Anytime, or Someday to selected tasks
- **THEN** the system updates every selected task's destination, start date, selected day horizon, dependent reminder, mutation metadata, revision, and relevant order while preserving selected order

#### Scenario: Apply a focused bulk value
- **WHEN** a selected-task keyboard command requires a start date, due date, organization, or reminder time
- **THEN** the interface opens a centered selection-owned surface, moves focus to its primary date or selection control, and applies the chosen value to every eligible selected task

#### Scenario: Preserve a bulk horizon while scheduling
- **WHEN** a user applies a future date to selected tasks with an Inbox, Now, Next, or Later horizon
- **THEN** the system retains the requested horizon for every valid selected task while the tasks remain in Upcoming

#### Scenario: Allow deliberately overdue bulk work
- **WHEN** a requested start date is later than one or more selected deadlines
- **THEN** the system retains those deadlines and accepts the schedule when every selected record is otherwise valid

#### Scenario: Reject one invalid bulk member
- **WHEN** an atomic bulk planning operation contains a task that is no longer open and present
- **THEN** the system rejects the operation without writing any selected task and leaves selection available for correction or retry

#### Scenario: Keep bulk scope bounded
- **WHEN** the user exits selection, changes views, or completes a successful bulk plan
- **THEN** the client clears selection and its range anchor without adding bulk completion, deletion, or source mutation

### Requirement: Keyboard-First Daily Operation
The system SHALL provide modifier-based keyboard operation for capture, editing, Today planning, direct view navigation, list traversal, lifecycle transitions, find, and dialogs while suppressing every matching browser-level command inside the mounted Tasks module.

#### Scenario: Navigate without a pointer
- **WHEN** a keyboard user moves through a task view
- **THEN** focus remains visible and predictable across every interactive control

#### Scenario: Complete selected work
- **WHEN** a user invokes Control+D on Mac or Control+Shift+D on Windows while a to-do is open
- **THEN** the system toggles that to-do's pending completion state without closing its editor or transitioning it to Done

#### Scenario: Invoke a task command safely
- **WHEN** focus is on a task title and no unrelated modal or composition event owns keyboard input
- **THEN** Enter retains ordinary button activation, Option+Up or Option+Down on Mac and Alt+Up or Alt+Down on Windows reorder within the current scope, and no unmodified letter or arrow key triggers a Tasks command

#### Scenario: Preserve keyboard focus after a task leaves the view
- **WHEN** completion, cancellation, movement, or recoverable deletion removes the focused task from the current view
- **THEN** focus moves to the task now occupying the same visual position, then the prior task, then task capture or the primary view heading when no task remains

#### Scenario: Open task capture, find, or keyboard help
- **WHEN** a keyboard user presses Command+N, Command+F, or Command+/ on Mac, or Control+N, Control+F, or Control+/ on Windows
- **THEN** the module respectively focuses task capture, opens quick find, or opens the keyboard-command reference and suppresses the matching browser command

#### Scenario: Navigate directly
- **WHEN** a keyboard user invokes a numbered view command or Command+Comma on Mac or Control+Comma on Windows
- **THEN** the module navigates to the corresponding task view or Config and suppresses the matching browser command

#### Scenario: Plan one or many tasks from the keyboard
- **WHEN** a user invokes the Today, Anytime, Someday, start date, due date, duplicate, organization, horizon, or reminder command with an open task or nonempty multi-selection
- **THEN** the module targets the multi-selection when present and otherwise targets the open task, applies the command to every eligible target, and suppresses the matching browser command

#### Scenario: Cycle Today with no Inbox transition
- **WHEN** Cmd+T or Ctrl+T targets work outside Today or already in Today
- **THEN** outside work moves to canonical Today Now while Today work cycles Now to Next to Later to Now and never enters Inbox

#### Scenario: Cycle a scheduled day horizon
- **WHEN** Cmd+H or Ctrl+H targets one or more tasks with future Start Dates
- **THEN** each eligible task cycles Now to Next to Later to Now without changing its Start Date

#### Scenario: Ignore an ineligible reminder command
- **WHEN** Cmd+E or Ctrl+E targets no task with a Start Date
- **THEN** the module makes no reminder mutation or focus change

#### Scenario: Submit inline hierarchy capture
- **WHEN** a keyboard user enters a nonblank area, project, project to-do, or checklist-item name and presses Enter without an active composition event
- **THEN** the corresponding hierarchy form submits exactly as its visible add button would

#### Scenario: Restore focus after a movement command
- **WHEN** a structural or temporal movement command succeeds and its command surface closes
- **THEN** focus returns to the moved task when it remains in the current view, or follows the same-position, prior-task, capture, and primary-heading fallback when the move removes it

#### Scenario: Autosave free-text editing
- **WHEN** a user changes a to-do title or notes in an open editor
- **THEN** the local value changes immediately and the module persists the latest nonblank title or exact notes source after a short debounce without a Save or Cancel action

#### Scenario: Autosave structured editing
- **WHEN** a user changes actionability, organization, start date, day horizon, deadline, Primary Link, reminder time, or reminder ambiguity in an open to-do
- **THEN** the module persists the changed field immediately without waiting for another field or an explicit submission

#### Scenario: Preserve autosave order
- **WHEN** a user makes multiple edits while one or more earlier autosave writes remain in flight
- **THEN** the module submits and resolves the writes in interaction order so an earlier request cannot replace a later accepted value

#### Scenario: Flush autosave on close
- **WHEN** a user closes an editor, opens another to-do, or leaves the current task view while a free-text debounce is pending
- **THEN** the module submits the latest valid draft and waits for that ordered write before committing any deferred completion for the closing to-do

#### Scenario: Keep autosave visually quiet
- **WHEN** an autosave write is pending or succeeds
- **THEN** the editor remains interactive and shows no routine saving or saved indicator

#### Scenario: Preserve autosave history
- **WHEN** an autosave batch is accepted
- **THEN** it is recorded as an ordinary task mutation that can be traversed by app-level undo and redo across to-dos

## ADDED Requirements

### Requirement: Global Task Quick Find
The system SHALL provide a keyboard-first quick find across to-dos, projects, and areas and a live full task-results route.

#### Scenario: Show the best quick matches
- **WHEN** a user types a substring in quick find
- **THEN** the surface updates with each keystroke and presents at most three matching to-do, project, or area results with their entity types

#### Scenario: Close quick find
- **WHEN** quick find is visible and the user presses Escape
- **THEN** the surface closes without changing task data

#### Scenario: Continue a search
- **WHEN** the user activates Continue Search
- **THEN** the module navigates to `/tasks/search` with the current query and lists every matching to-do from every planning and lifecycle view

#### Scenario: Refine full results
- **WHEN** the user edits the query on the search-results page
- **THEN** the URL query and full to-do results update with each keystroke

#### Scenario: Open a hierarchy result
- **WHEN** the user activates a project or area quick-find result
- **THEN** a real in-app link opens that hierarchy record and preserves modified-click behavior

### Requirement: Task Duplication
The system SHALL duplicate active to-dos from an open task or multi-selection without copying immutable provenance or automation identity.

#### Scenario: Duplicate mutable task content
- **WHEN** the user invokes the duplicate command for one or more open present tasks
- **THEN** the system creates one new task per source with the same user-editable title, notes, actionability, planning, container, deadline, and Primary Link

#### Scenario: Exclude nonduplicable identity
- **WHEN** a duplicate task is created
- **THEN** it receives new record, mutation, order, and history identity and does not copy typed source, idempotency, reminder, recurrence, completion, cancellation, or deletion state

### Requirement: Task Row Temporal Metadata
The system SHALL distinguish Start and Due metadata in task rows with semantic Lucide icons and time-direction copy.

#### Scenario: Show temporal types
- **WHEN** a task row presents a Start Date or Due Date
- **THEN** Start uses the Lucide Play icon and Due uses the Lucide FlagTriangleRight icon

#### Scenario: Describe a future start
- **WHEN** Upcoming presents a task whose Start Date is two days after the planning date
- **THEN** the row presents the Play icon and the copy `In 2 days` rather than remaining-time copy

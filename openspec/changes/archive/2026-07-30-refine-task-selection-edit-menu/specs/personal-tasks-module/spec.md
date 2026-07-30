## MODIFIED Requirements

### Requirement: Bulk Task Planning
The system SHALL provide an accessible task-row selection mode for visible tasks, SHALL treat selection as a temporary context bounded by task rows and selection-owned surfaces, SHALL expose its controls as a fixed bottom overlay that does not move list content, and SHALL apply only lifecycle-appropriate editing or clipboard actions to selected records.

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
- **WHEN** selection is active and a user ordinarily activates, Command-clicks on Mac, Control-clicks on Windows, or Shift-clicks a visible task summary
- **THEN** the interface updates that task's direct, additive, or anchored-range selection without opening its editor

#### Scenario: Toggle selection through its dedicated control
- **WHEN** selection is active and a user activates a task's circular selection control
- **THEN** the interface toggles only that task's selected state without opening its editor

#### Scenario: Deselect the final task from its summary
- **WHEN** exactly one task remains selected and the user ordinarily activates that task's summary
- **THEN** Tasks deselects the task, exits selection mode, removes the selection toolbar, and does not open the task editor

#### Scenario: Preserve ordinary task expansion
- **WHEN** selection is inactive and a user ordinarily clicks a task without performing the touch-selection gesture
- **THEN** the interface opens or closes that task's editor exactly as before

#### Scenario: Operate selection accessibly
- **WHEN** selection mode is active in Today, Upcoming, Anytime, Someday, or Done
- **THEN** the fixed bottom selection overlay reports `X Task` or `X Tasks`, exposes only Select All, Edit, and Cancel, communicates each selected state to keyboard and assistive-technology users without shifting list content, disables Edit at zero selected tasks, and disables editing choices that are illegal for the selected records

#### Scenario: Present the bulk Edit menu
- **WHEN** one or more tasks are selected and the user activates Edit
- **THEN** Tasks presents Start, Deadline, Area, Actionability, and Delete using the same menu structure and choice labels as the singular task ellipsis menu and omits Repeat

#### Scenario: Preserve native text selection
- **WHEN** a text input, textarea, or contenteditable region owns Command+A on Mac or Control+A on Windows
- **THEN** the interface leaves the gesture available to that editable control and does not change task selection

#### Scenario: Dismiss selection outside a task
- **WHEN** bulk selection is active and the user presses the pointer outside every task row and outside the controls that operate the active selection
- **THEN** the interface clears the selection and range anchor and returns to ordinary task interaction

#### Scenario: Retain selection for owned interactions
- **WHEN** bulk selection is active and the user interacts with a task summary, circular task-selection control, the bulk toolbar, or its edit, calendar, Area, or Actionability surface
- **THEN** the interface leaves selection active until the owned interaction changes the selected membership or explicitly exits selection

#### Scenario: Preserve access to the final task
- **WHEN** the fixed selection overlay is visible above the list
- **THEN** the list retains enough bottom scroll space for its final task and controls to move fully above the overlay

#### Scenario: Exit selection directly
- **WHEN** a user presses Escape, activates Cancel, changes views, or clicks outside a task and outside a selection-owned surface
- **THEN** the client clears selection and its stable range anchor and returns to ordinary editing

#### Scenario: Apply a focused bulk value
- **WHEN** the bulk Edit menu or a selected-task keyboard command requires a start date, deadline, Area, Actionability, or reminder time
- **THEN** the interface opens the appropriate selection-owned surface or nested menu and applies the chosen value to every eligible selected task

#### Scenario: Clear bulk horizons while scheduling
- **WHEN** a user applies a future date to selected tasks
- **THEN** the system clears every selected task's Today horizon while the tasks remain in Upcoming

#### Scenario: Allow deliberately overdue bulk work
- **WHEN** a requested start date is later than one or more selected deadlines
- **THEN** the system retains those deadlines and accepts the schedule when every selected record is otherwise valid

#### Scenario: Reject one invalid bulk member
- **WHEN** any selected task is ineligible for the requested edit
- **THEN** the system rejects the operation without writing any selected task and leaves selection available for correction or retry

#### Scenario: Retain eligible tasks after editing
- **WHEN** a bulk edit succeeds and one or more previously selected tasks remain eligible for the current view
- **THEN** selection mode remains active and every still-visible affected task remains selected

#### Scenario: Prune tasks that leave the view
- **WHEN** a bulk edit causes some previously selected tasks to become ineligible for the current view
- **THEN** Tasks removes those tasks from the rendered list and the selection while retaining selection mode and every affected task that remains visible

#### Scenario: Retain empty selection after editing
- **WHEN** a bulk edit causes every previously selected task to become ineligible for the current view
- **THEN** Tasks moves the tasks to their eligible views and keeps selection mode active with `0 Tasks`

#### Scenario: Delete selected tasks recoverably
- **WHEN** the user chooses Delete from the bulk Edit menu for eligible open tasks
- **THEN** Tasks moves every selected task to Done as trashed, removes those tasks from the current active list, and keeps selection mode active with zero selected tasks

#### Scenario: Select terminal Done tasks for nondestructive actions
- **WHEN** the user selects one or more tasks in Done
- **THEN** Tasks permits Copy and Duplicate, rejects Cut and active-task-only edits, and does not select deleted hierarchy records

### Requirement: Explicit Task Selection Entry
Tasks SHALL expose a point-and-click entry into task selection mode on every selection-capable task list, SHALL permit that explicit entry and edit-driven reconciliation to retain zero selected tasks, and SHALL keep every selection-dependent action unavailable until its minimum selection requirement is met.

#### Scenario: Enter empty selection mode from a list
- **WHEN** a user activates Select Tasks from Today, Upcoming, Anytime, Someday, or Done while selection mode is inactive
- **THEN** Tasks closes any open task editor, clears lightweight task focus and the range anchor, enters selection mode with zero selected tasks, shows circular selection controls, and presents the fixed toolbar reporting `0 Tasks`

#### Scenario: Omit selection entry from non-list surfaces
- **WHEN** a user views Config, Templates, Search, or an Area-detail surface
- **THEN** Tasks does not present the Select Tasks action

#### Scenario: Keep zero-selection actions safe
- **WHEN** selection mode is active with zero selected tasks
- **THEN** Edit is disabled, selection-dependent surfaces cannot open, Cancel remains available to exit selection mode, and Select All is enabled only when at least one selectable task is visible

#### Scenario: Select one task after empty entry
- **WHEN** the user activates one task's summary or circular selection control after entering empty selection mode
- **THEN** Tasks selects that task, establishes the selection anchor, keeps selection mode active, and enables actions that require at least one eligible selected task

#### Scenario: Exit after manually returning to zero
- **WHEN** the user manually deselects the final selected task after the selection has contained one or more tasks
- **THEN** Tasks automatically exits selection mode and removes the fixed selection toolbar

#### Scenario: Preserve zero after edit-driven reconciliation
- **WHEN** selection membership reaches zero because a successful edit moved every selected task out of the current view
- **THEN** Tasks retains selection mode and the fixed toolbar until the user activates Cancel, Select All, or another explicit selection exit

#### Scenario: Select all from an empty one-task list
- **WHEN** selection mode is active with zero selected tasks, exactly one selectable task is visible, and the user activates Select All
- **THEN** Tasks selects that task within selection mode rather than converting it to lightweight whole-task focus

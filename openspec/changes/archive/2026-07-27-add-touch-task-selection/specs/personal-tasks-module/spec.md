## ADDED Requirements

### Requirement: Touch Task Selection
Tasks SHALL let a touch user enter task selection by deliberately swiping left on an eligible task summary, SHALL select the swiped task as part of that transition, and SHALL preserve browser-owned scrolling and navigation gestures that do not qualify.

#### Scenario: Enter selection with a touch swipe
- **WHEN** selection mode is inactive and an actual touch pointer completes a leftward task-summary swipe of at least 48 CSS pixels whose horizontal displacement is at least 1.25 times its vertical displacement
- **THEN** Tasks safely closes any open editor, clears lightweight focus, enters selection mode, selects the swiped task, establishes it as the range anchor, and prevents the completed swipe from also activating a row control

#### Scenario: Preserve vertical touch scrolling
- **WHEN** a touch movement on a task summary is predominantly vertical or does not reach the qualifying leftward distance
- **THEN** Tasks does not change selection and leaves native vertical page scrolling available

#### Scenario: Preserve browser edge gestures
- **WHEN** a touch begins within 24 CSS pixels of either viewport edge
- **THEN** Tasks does not interpret that contact as task selection

#### Scenario: Ignore non-touch pointers
- **WHEN** a mouse, trackpad, or pen performs equivalent pointer movement across a task summary
- **THEN** Tasks does not enter selection through the swipe gesture

#### Scenario: Cancel interrupted touch selection
- **WHEN** the browser cancels the active touch pointer before a qualifying release
- **THEN** Tasks clears transient gesture state without changing task selection

#### Scenario: Keep Done touch-selectable but fixed
- **WHEN** a user swipes a task in Done
- **THEN** Tasks selects that task through the same touch gesture while continuing to prohibit Done-list reordering

#### Scenario: Reorder a touch-selected group natively
- **WHEN** the active browser begins a native drag from the summary of one selected task after touch selection
- **THEN** Tasks moves the complete selected group through its existing native grouped drag transaction without introducing custom pointer dragging or custom scrolling

## MODIFIED Requirements

### Requirement: Bulk Task Planning
The system SHALL provide an accessible task-row selection mode for visible tasks, SHALL treat selection as a temporary context bounded by task rows and selection-owned surfaces, SHALL expose its controls as a fixed bottom overlay that does not move list content, and SHALL apply only lifecycle-appropriate planning or clipboard actions to selected records.

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
- **THEN** the fixed bottom selection overlay reports the selected count, exposes Select All and Cancel, communicates each selected state to keyboard and assistive-technology users without shifting list content, disables selection-dependent actions at zero selected tasks, and withholds planning actions that are illegal for terminal Done records

#### Scenario: Preserve native text selection
- **WHEN** a text input, textarea, or contenteditable region owns Command+A on Mac or Control+A on Windows
- **THEN** the interface leaves the gesture available to that editable control and does not change task selection

#### Scenario: Dismiss selection outside a task
- **WHEN** bulk selection is active and the user presses the pointer outside every task row and outside the controls that operate the active selection
- **THEN** the interface clears the selection and range anchor and returns to ordinary task interaction

#### Scenario: Retain selection for owned interactions
- **WHEN** bulk selection is active and the user interacts with a task summary, circular task-selection control, the bulk toolbar, or its planning, calendar, organization, or reminder surface
- **THEN** the interface leaves selection active until the owned interaction changes the selected membership or explicitly exits selection

#### Scenario: Preserve access to the final task
- **WHEN** the fixed selection overlay is visible above the list
- **THEN** the list retains enough bottom scroll space for its final task and controls to move fully above the overlay

#### Scenario: Exit selection directly
- **WHEN** a user presses Escape, activates Cancel, activates Done, changes views, or clicks outside a task and outside a selection-owned surface
- **THEN** the client clears selection and its stable range anchor and returns to ordinary editing

#### Scenario: Plan selected tasks
- **WHEN** a user applies Today Inbox, Today Now, Today Next, Today Later, Remove from Today, Tomorrow, Anytime, or Someday to selected tasks
- **THEN** the system updates every selected task's destination, start date, selected day horizon, dependent reminder, mutation metadata, revision, and relevant order in one local transaction while preserving selected order

#### Scenario: Apply a focused bulk value
- **WHEN** a selected-task keyboard command requires a start date, deadline, organization, or reminder time
- **THEN** the interface opens a centered selection-owned surface, moves focus to its primary date or selection control, and applies the chosen value to every eligible selected task

#### Scenario: Clear bulk horizons while scheduling
- **WHEN** a user applies a future date to selected tasks
- **THEN** the system clears every selected task's Today horizon while the tasks remain in Upcoming

#### Scenario: Allow deliberately overdue bulk work
- **WHEN** a requested start date is later than one or more selected deadlines
- **THEN** the system retains those deadlines and accepts the schedule when every selected record is otherwise valid

#### Scenario: Reject one invalid bulk member
- **WHEN** any selected task is no longer open and present
- **THEN** the system rejects the operation without writing any selected task and leaves selection available for correction or retry

#### Scenario: Keep bulk scope bounded
- **WHEN** the user exits selection, changes views, or completes a successful bulk plan
- **THEN** the client clears selection and its range anchor and returns to ordinary editing without adding bulk completion, deletion, or hierarchy mutation

#### Scenario: Select terminal Done tasks for nondestructive actions
- **WHEN** the user selects one or more tasks in Done
- **THEN** Tasks permits Copy and Duplicate, rejects Cut and open-task planning, and does not select deleted hierarchy records

### Requirement: Explicit Task Selection Entry
Tasks SHALL expose a point-and-click entry into task selection mode on every selection-capable task list, SHALL permit that explicit entry to begin with zero selected tasks, and SHALL keep every selection-dependent action unavailable until its minimum selection requirement is met.

#### Scenario: Enter empty selection mode from a list
- **WHEN** a user activates Select Tasks from Today, Upcoming, Anytime, Someday, or Done while selection mode is inactive
- **THEN** Tasks closes any open task editor, clears lightweight task focus and the range anchor, enters selection mode with zero selected tasks, shows circular selection controls, and presents the fixed toolbar reporting `0 Tasks Selected`

#### Scenario: Omit selection entry from non-list surfaces
- **WHEN** a user views Config, Templates, Search, or an Area-detail surface
- **THEN** Tasks does not present the Select Tasks action

#### Scenario: Keep zero-selection actions safe
- **WHEN** selection mode is active with zero selected tasks
- **THEN** Cancel and Plan Selected are disabled, selection-dependent dialogs cannot open, Done remains available to exit selection mode, and Select All is enabled only when at least one selectable task is visible

#### Scenario: Select one task after empty entry
- **WHEN** the user activates one task's summary or circular selection control after entering empty selection mode
- **THEN** Tasks selects that task, establishes the selection anchor, keeps selection mode active, and enables actions that require at least one eligible selected task

#### Scenario: Exit after returning to zero
- **WHEN** the user deselects the final selected task after the selection has contained one or more tasks
- **THEN** Tasks automatically exits selection mode and removes the fixed selection toolbar

#### Scenario: Select all from an empty one-task list
- **WHEN** selection mode is active with zero selected tasks, exactly one selectable task is visible, and the user activates Select All
- **THEN** Tasks selects that task within selection mode rather than converting it to lightweight whole-task focus

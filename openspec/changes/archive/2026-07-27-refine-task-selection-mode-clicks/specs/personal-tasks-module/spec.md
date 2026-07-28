## MODIFIED Requirements

### Requirement: Bulk Task Planning
The system SHALL provide an accessible task-row selection mode for visible to-dos, SHALL treat selection as a temporary context bounded by to-do rows and selection-owned surfaces, SHALL expose its controls as a fixed bottom overlay that does not move list content, and SHALL apply only lifecycle-appropriate planning or clipboard actions to selected records.

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
- **WHEN** selection is active and a user Command-clicks on Mac, Control-clicks on Windows, or Shift-clicks a visible task activation surface
- **THEN** the interface updates that task's additive or anchored-range selection without opening its editor

#### Scenario: Toggle selection through its dedicated control
- **WHEN** selection is active and a user ordinarily clicks a task's circular selection control
- **THEN** the interface toggles only that task's selected state without opening its editor

#### Scenario: Open a task from selection mode
- **WHEN** selection is active and a user ordinarily clicks the activation surface of a visible task rather than its circular selection control or another direct row control
- **THEN** the interface clears explicit selection and its range anchor, removes the bulk toolbar, and opens the clicked task's editor

#### Scenario: Preserve ordinary task expansion
- **WHEN** selection is inactive and a user ordinarily clicks a task
- **THEN** the interface opens or closes that task's editor exactly as before

#### Scenario: Operate selection accessibly
- **WHEN** one or more visible to-dos are selected in Today, Upcoming, Anytime, Someday, or Done
- **THEN** the fixed bottom selection overlay reports the selected count, exposes Select All and Select None, communicates each selected state to keyboard and assistive-technology users without shifting list content, and withholds planning actions that are illegal for terminal Done records

#### Scenario: Preserve native text selection
- **WHEN** a text input, textarea, or contenteditable region owns Command+A on Mac or Control+A on Windows
- **THEN** the interface leaves the gesture available to that editable control and does not change task selection

#### Scenario: Dismiss selection outside a to-do
- **WHEN** bulk selection is active and the user presses the pointer outside every to-do row and outside the controls that operate the active selection
- **THEN** the interface clears the selection and range anchor and returns to ordinary task interaction

#### Scenario: Retain selection for owned interactions
- **WHEN** bulk selection is active and the user interacts with a circular task-selection control, the bulk toolbar, or its planning, calendar, organization, or reminder surface
- **THEN** the interface leaves selection active until the owned interaction applies its selection or planning behavior

#### Scenario: Preserve access to the final task
- **WHEN** the fixed selection overlay is visible above the list
- **THEN** the list retains enough bottom scroll space for its final task and controls to move fully above the overlay

#### Scenario: Exit selection directly
- **WHEN** a user presses Escape, activates Done, changes views, or clicks outside a to-do and outside a selection-owned surface
- **THEN** the client clears selection and its stable range anchor and returns to ordinary editing

#### Scenario: Plan selected tasks
- **WHEN** a user applies Today Inbox, Today Now, Today Next, Today Later, Remove from Today, Tomorrow, Anytime, or Someday to selected tasks
- **THEN** the system updates every selected task's destination, start date, selected day horizon, dependent reminder, mutation metadata, revision, and relevant order in one local transaction while preserving selected order

#### Scenario: Apply a focused bulk value
- **WHEN** a selected-task keyboard command requires a start date, due date, organization, or reminder time
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
- **WHEN** the user selects one or more to-dos in Done
- **THEN** Tasks permits Copy and Duplicate, rejects Cut and open-task planning, and does not select deleted hierarchy records

### Requirement: Whole-Task Focus And Selection
The Tasks module SHALL represent no task target, one whole-task-focused closed task, one or more explicitly selected tasks, and one open task as distinct interaction states; SHALL preserve granular sequential keyboard access to every interactive control in collapsed task summaries; and SHALL provide a faster Space-and-arrow whole-task traversal mode.

#### Scenario: Traverse task summaries and the complete page
- **WHEN** a keyboard user presses Tab or Shift+Tab in or around a collapsed task summary
- **THEN** native sequential focus visits the task row and its available completion, title, source-link, and actions controls in DOM order and can continue to controls outside the task list

#### Scenario: Leave whole-task focus for granular Tab traversal
- **WHEN** Tab or Shift+Tab is pressed while one closed task has whole-task focus
- **THEN** Tasks clears whole-task focus and its range anchor without blurring the current element or preventing native sequential focus movement

#### Scenario: Enter whole-task focus from the Tasks background
- **WHEN** no task is focused, open, or multiply selected; no nested surface is open; an eligible noninteractive Tasks page or list surface owns focus; and the user presses a nonrepeated unmodified Space
- **THEN** Tasks prevents page scrolling, gives whole-task focus to the first visible task, scrolls it into view, and does not open it

#### Scenario: Promote a Tab-focused task row
- **WHEN** a closed task row has granular Tab focus without whole-task focus and the user presses a nonrepeated unmodified Space
- **THEN** Tasks prevents page scrolling, promotes that same row into whole-task focus, establishes the range anchor, and does not open or advance the task

#### Scenario: Traverse whole-task focus with Space
- **WHEN** a closed task has whole-task focus and the user presses a nonrepeated unmodified Space or Shift+Space
- **THEN** Tasks prevents page scrolling and moves whole-task focus to the next or previous visible task respectively, wrapping across list boundaries and scrolling the destination into view

#### Scenario: Ignore held Space traversal
- **WHEN** a Space or Shift+Space keydown repeats while a task has whole-task focus
- **THEN** Tasks prevents page scrolling but performs no additional focus movement

#### Scenario: Wrap arrow traversal
- **WHEN** ArrowDown or ArrowUp is pressed while a closed task has whole-task focus
- **THEN** focus moves to the next or previous visible task respectively, wraps across list boundaries, and scrolls the destination into view without moving task order

#### Scenario: Preserve native Space ownership
- **WHEN** Space is pressed while an interactive task control, link, editable control, open task, multiple selection, dialog, menu, listbox, popover, or unrelated page control owns the interaction
- **THEN** Tasks does not invoke whole-task Space traversal and preserves that surface's native or documented Space behavior

#### Scenario: Select one task with a modified click
- **WHEN** a user Command-clicks on Mac, Control-clicks on Windows, or Shift-clicks the activation surface of a task while no task selection is active
- **THEN** Tasks enters explicit selection mode, selects that task, establishes it as the range anchor, presents its selection control and the fixed bulk toolbar, and does not open the editor

#### Scenario: Clear one explicitly selected task
- **WHEN** the user repeats the platform-modifier click on the only explicitly selected task
- **THEN** Tasks clears selection mode and the range anchor without opening the task

#### Scenario: Toggle one task from its selection control
- **WHEN** explicit selection mode is active and the user ordinarily clicks a task's circular selection control
- **THEN** Tasks toggles that task's selected state and preserves selection mode whenever at least one task remains selected

#### Scenario: Open one task from explicit selection
- **WHEN** explicit selection mode is active and the user ordinarily clicks a task's activation surface
- **THEN** Tasks clears the explicit selection and range anchor, closes the bulk toolbar, opens the clicked task, and focuses its Summary without reopening any formerly selected task

#### Scenario: Begin selection from keyboard focus
- **WHEN** one closed task has lightweight whole-task keyboard focus and the user modifier-clicks or Shift-clicks a task activation surface
- **THEN** Tasks enters explicit selection mode with the keyboard-focused task as the selected anchor; selects the clicked task or anchored range as applicable; clears lightweight whole-task focus; and shows the fixed bulk toolbar

#### Scenario: Add to explicit selection
- **WHEN** a user additively modifier-clicks another task or Shift-clicks away from the selection range anchor
- **THEN** Tasks updates the explicit selection, clears closed focus, closes any open editor first, and keeps the fixed bulk toolbar visible

#### Scenario: Enter multiple selection from an open task
- **WHEN** one task is open and the user additively modifier-clicks or Shift-clicks a different visible task
- **THEN** Tasks treats the open task as the initial selection anchor, closes its editor, selects both tasks, and shows the fixed bulk toolbar

#### Scenario: Replace a selected range
- **WHEN** Shift-click selects a new visible endpoint while multi-selection remains active
- **THEN** Tasks replaces the prior range with the contiguous visible task range from the stable anchor to that endpoint

#### Scenario: Retain selection mode with one task
- **WHEN** pointer selection reduces a multi-selection to exactly one task
- **THEN** Tasks keeps selection mode, the remaining task's selection control, and the fixed bulk toolbar visible, and does not reopen an editor

#### Scenario: Clear all task targeting
- **WHEN** a user clicks outside every task and selection-owned surface or navigates to another Tasks view
- **THEN** Tasks clears closed focus, multi-selection, and the range anchor after completing any required open-editor close

#### Scenario: Relinquish collapsed task focus with Escape
- **WHEN** Escape is pressed while a collapsed task row or one of its granular row controls has keyboard focus and no nested surface owns Escape
- **THEN** Tasks clears whole-task focus and its range anchor, blurs the row-owned active element, and performs no task mutation

#### Scenario: Preserve direct row controls
- **WHEN** a user clicks a completion control, actions trigger, source link, or Primary Link, including a modified click on a link
- **THEN** that control retains its pointer behavior and ordinary modified-link behavior without being reinterpreted as task focus or selection

#### Scenario: Open a focused task
- **WHEN** Return or the platform Open/Close Task command is invoked on one focused closed task
- **THEN** Tasks clears closed focus, opens that task, focuses its Summary at the insertion point end, and keeps multi-selection inactive

#### Scenario: Close to whole-row focus
- **WHEN** the Open/Close Task command closes an open task
- **THEN** Tasks flushes autosave, commits deferred completion, and returns focus to the complete surviving task row or the documented same-position fallback

#### Scenario: Target one focused task
- **WHEN** a supported completion, planning, actionability, organization, checklist, clipboard, duplication, or lifecycle command is invoked with one focused closed task
- **THEN** Tasks applies the same eligible single-target behavior available to an open task or multi-selection without showing bulk controls

#### Scenario: Converge bulk actionability before advancing
- **WHEN** the user cycles actionability for multiple selected tasks whose actionability states are mixed or uniformly Ready
- **THEN** Tasks sets every selected task to Waiting
- **WHEN** every selected task is already Waiting
- **THEN** Tasks sets every selected task to Rechecking
- **WHEN** every selected task is already Rechecking
- **THEN** Tasks sets every selected task to Ready

#### Scenario: Open inline metadata from closed focus
- **WHEN** a focused closed task receives a command whose interaction surface exists only inside the expanded editor
- **THEN** Tasks opens the task, focuses the requested surface, and preserves ordinary autosave behavior

#### Scenario: Copy or cut one focused task
- **WHEN** a task-object Copy or eligible Cut command is invoked with one focused closed task and no editable control owns native clipboard behavior
- **THEN** Tasks serializes that task through the ordinary task clipboard contract and applies Cut lifecycle behavior only after the clipboard write succeeds

#### Scenario: Duplicate one focused closed task
- **WHEN** Duplicate is invoked with one focused closed task
- **THEN** Tasks creates one closed duplicate at the documented destination and transfers whole-row focus to the duplicate without opening it

#### Scenario: Traverse while opening
- **WHEN** Control+S or Control+W on Mac, or the corresponding Alt+Shift chord on Windows, is invoked with no open task
- **THEN** Tasks uses the focused closed task as the current position, opens the next or previous visible task, opens the first or last task when no task is focused, and does not wrap at list boundaries

#### Scenario: Focus after a task leaves the view
- **WHEN** an immediate command removes the focused closed task from the current view
- **THEN** focus moves to the task at the same visual position, then the prior visible task, then clears when no visible task remains

#### Scenario: Restore action focus to the whole task
- **WHEN** a task completion, lifecycle, menu, or task-owned dialog action returns keyboard focus to a collapsed task that remains in the current list or to its same-position fallback
- **THEN** Tasks establishes whole-task focus on the complete task row and does not leave focus on a nested completion, title, source-link, or actions control

#### Scenario: Select all under the state threshold
- **WHEN** Select All targets one visible task
- **THEN** Tasks establishes single-task focus without showing bulk controls
- **WHEN** Select All targets two or more visible tasks
- **THEN** Tasks enters multi-selection and shows the bulk toolbar

#### Scenario: Present one whole-task focus target accessibly
- **WHEN** assistive technology inspects a collapsed task
- **THEN** the complete row has a nonempty task name and visible focus treatment while every available nested interactive control remains named and sequentially keyboard accessible

#### Scenario: Keep the focus treatment consistent across navigation methods
- **WHEN** whole-task focus is established or moved by Space, Shift+Space, ArrowUp, or ArrowDown
- **THEN** the focused task uses the same thick white inset outline without an additional browser-native focus color

#### Scenario: Present granular row focus without whole-task focus
- **WHEN** native Tab traversal focuses a closed task row without promoting it into whole-task focus
- **THEN** the row exposes a visible white keyboard focus outline while task commands do not retain a stale whole-task target after granular traversal continues

#### Scenario: Describe the toggle command
- **WHEN** the Keyboard Commands reference presents the former Close Task action
- **THEN** it labels the action Open/Close Task and documents its focused-closed and open-task behavior for Mac and Windows

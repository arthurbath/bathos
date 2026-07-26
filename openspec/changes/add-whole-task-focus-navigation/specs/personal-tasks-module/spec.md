## ADDED Requirements

### Requirement: Whole-Task Focus And Selection
The Tasks module SHALL represent no task target, one whole-task-focused closed task, multiple selected tasks, and one open task as distinct interaction states; SHALL preserve granular sequential keyboard access to every interactive control in collapsed task summaries; and SHALL provide a faster Space-and-arrow whole-task traversal mode.

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

#### Scenario: Exclude non-task records
- **WHEN** Space or arrow whole-task traversal crosses section or hierarchy boundaries
- **THEN** it includes only visible task rows and excludes projects, areas, headings, templates, checklist items, controls, and hidden records

#### Scenario: Establish one focused task
- **WHEN** a user Command-clicks on Mac, Control-clicks on Windows, or Shift-clicks the activation surface of a task while no task selection is active
- **THEN** Tasks focuses that one closed task, establishes it as the range anchor, withholds the bulk toolbar and selection controls, and does not open the editor

#### Scenario: Clear one focused task
- **WHEN** the user repeats the platform-modifier click on the only focused closed task
- **THEN** Tasks clears task focus and the range anchor without opening bulk mode

#### Scenario: Enter multiple selection
- **WHEN** a user additively modifier-clicks a second task or Shift-clicks away from the focused range anchor
- **THEN** Tasks selects at least two tasks, clears closed focus, closes any open editor first, and shows the fixed bulk toolbar

#### Scenario: Replace a selected range
- **WHEN** Shift-click selects a new visible endpoint while multi-selection remains active
- **THEN** Tasks replaces the prior range with the contiguous visible task range from the stable anchor to that endpoint

#### Scenario: Collapse selection to one focus
- **WHEN** pointer selection reduces a multi-selection to exactly one task
- **THEN** Tasks dismisses bulk controls, removes selection controls, and retains the remaining task as the one focused closed task

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
- **WHEN** whole-task focus is established or moved by modified click, Space, Shift+Space, ArrowUp, or ArrowDown
- **THEN** the focused task uses the same thick white inset outline without an additional browser-native focus color

#### Scenario: Present granular row focus without whole-task focus
- **WHEN** native Tab traversal focuses a closed task row without promoting it into whole-task focus
- **THEN** the row exposes a visible white keyboard focus outline while task commands do not retain a stale whole-task target after granular traversal continues

#### Scenario: Describe the toggle command
- **WHEN** the Keyboard Commands reference presents the former Close Task action
- **THEN** it labels the action Open/Close Task and documents its focused-closed and open-task behavior for Mac and Windows

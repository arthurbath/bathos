## ADDED Requirements

### Requirement: Task Temporal Picker Entry Points
The Tasks module SHALL reuse its complete Start picker and ordinary Deadline picker content across expanded-editor, task-menu, focused-task command, and selection-mode command entry points without adding alternate temporal forms.

#### Scenario: Open an anchored Start picker from a task menu
- **WHEN** a user activates Start from an active task's ellipsis menu
- **THEN** Tasks aligns that task's summary row as close as possible to the top of the visible content area and opens the complete Start picker centered beneath the summary row without a dialog title, descriptive header, or close button

#### Scenario: Open an anchored Deadline picker from a task menu
- **WHEN** a user activates Deadline from an active task's ellipsis menu
- **THEN** Tasks aligns that task's summary row as close as possible to the top of the visible content area and opens the same Deadline calendar and Clear action used by the expanded editor centered beneath the summary row without additional modal chrome

#### Scenario: Open a temporal picker for a keyboard-focused task
- **WHEN** Control+E or Control+D on Mac, or the corresponding Alt+Shift command on Windows, targets one keyboard-focused closed task outside selection mode
- **THEN** Tasks leaves the metadata drawer closed, aligns the task summary row near the visible content top, and opens the corresponding Start or Deadline picker beneath that row

#### Scenario: Open a centered temporal picker for selected tasks
- **WHEN** Control+E or Control+D on Mac, or the corresponding Alt+Shift command on Windows, targets one or more tasks in selection mode
- **THEN** Tasks preserves the list scroll position and presents the corresponding shared picker content centered in the viewport for the complete selection

#### Scenario: Continue advancing an open Start picker
- **WHEN** Control+E or its corresponding Windows command is pressed while the complete Start picker is already open
- **THEN** Tasks advances the picker's current Start focus through Today horizons and future dates under the existing Start advancement contract instead of reopening or relocating the picker

## MODIFIED Requirements

### Requirement: Focused To-Do Action Menu
The Tasks interface SHALL keep an active task's ellipsis menu limited to Start, Deadline, Area, Actionability, Repeat, and recoverable Delete while retaining drag, keyboard ordering, and complete metadata editing outside that menu.

#### Scenario: Present direct task actions
- **WHEN** a user opens an active non-projection task's ellipsis menu
- **THEN** the menu presents Start, Deadline, Area, Actionability, Repeat when eligible, and Delete in that order and does not present Move, Do, direct Mark As actions, Cancel, Move Up, or Move Down

#### Scenario: Choose an Area through a submenu
- **WHEN** a user opens Area from a task's ellipsis menu
- **THEN** a neighboring submenu presents No Area followed by every configured Area, selecting one value applies it through the ordinary task update path, and both menus close

#### Scenario: Choose Actionability through a submenu
- **WHEN** a user opens Actionability from a task's ellipsis menu
- **THEN** a neighboring submenu presents Ready, Rechecking, and Waiting in conceptual order, disables the task's current value, and selecting another value applies it through the ordinary task update path before both menus close

#### Scenario: Delete from the task menu
- **WHEN** a user activates Delete from an active task's ellipsis menu
- **THEN** Tasks moves the task to Done with the deleted disposition rather than completing it

### Requirement: Task Ellipsis Menu Relinquishes Focus
The Tasks interface SHALL end ellipsis-menu interaction without retaining or transferring whole-task keyboard focus.

#### Scenario: Dismiss the ellipsis menu
- **WHEN** a user opens a task's ellipsis menu and dismisses it without selecting an action
- **THEN** Tasks closes the menu, prevents focus restoration to its trigger, and leaves no task with whole-task focus

#### Scenario: Complete a direct menu action
- **WHEN** a user selects an Area, Actionability, or recoverable Delete action from a task's ellipsis menu
- **THEN** Tasks applies the accepted action without focusing the originating task or a fallback task

#### Scenario: Close a menu-launched task surface
- **WHEN** Start, Deadline, or Repeat was opened through a task's ellipsis menu and that surface is completed or dismissed
- **THEN** Tasks closes the surface without focusing the originating task or another task

#### Scenario: Preserve non-menu focus behavior
- **WHEN** a task action is invoked through a direct task control or documented keyboard command rather than the ellipsis menu
- **THEN** Tasks retains that action's existing whole-task focus or fallback behavior

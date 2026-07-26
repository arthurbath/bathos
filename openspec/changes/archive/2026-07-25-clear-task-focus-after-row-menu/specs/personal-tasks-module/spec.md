## ADDED Requirements

### Requirement: Task Ellipsis Menu Relinquishes Focus
The Tasks interface SHALL end ellipsis-menu interaction without retaining or transferring whole-task keyboard focus.

#### Scenario: Dismiss the ellipsis menu
- **WHEN** a user opens a task's ellipsis menu and dismisses it without selecting an action
- **THEN** Tasks closes the menu, prevents focus restoration to its trigger, and leaves no task with whole-task focus

#### Scenario: Complete a direct menu action
- **WHEN** a user selects an actionability or recoverable Delete action from a task's ellipsis menu
- **THEN** Tasks applies the accepted action without focusing the originating task or a fallback task

#### Scenario: Close a menu-launched task surface
- **WHEN** Move, Do, or Start was opened through a task's ellipsis menu and that surface is completed or dismissed
- **THEN** Tasks closes the surface without focusing the originating task or another task

#### Scenario: Preserve non-menu focus behavior
- **WHEN** a task action is invoked through a direct task control or documented keyboard command rather than the ellipsis menu
- **THEN** Tasks retains that action's existing whole-task focus or fallback behavior

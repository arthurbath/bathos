## ADDED Requirements

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
- **THEN** Select None and Plan Selected are disabled, selection-dependent dialogs cannot open, Done remains available to exit selection mode, and Select All is enabled only when at least one selectable task is visible

#### Scenario: Select one task after empty entry
- **WHEN** the user activates one task's circular selection control after entering empty selection mode
- **THEN** Tasks selects that task, establishes the selection anchor, keeps selection mode active, and enables actions that require at least one eligible selected task

#### Scenario: Exit after returning to zero
- **WHEN** the user deselects the final selected task after the selection has contained one or more tasks
- **THEN** Tasks automatically exits selection mode and removes the fixed selection toolbar

#### Scenario: Select all from an empty one-task list
- **WHEN** selection mode is active with zero selected tasks, exactly one selectable task is visible, and the user activates Select All
- **THEN** Tasks selects that task within selection mode rather than converting it to lightweight whole-task focus

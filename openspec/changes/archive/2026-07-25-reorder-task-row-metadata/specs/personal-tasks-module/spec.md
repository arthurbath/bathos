## MODIFIED Requirements

### Requirement: Task Row Temporal Metadata
The system SHALL present Deadline metadata in task rows with the semantic Lucide FlagTriangleRight icon, numeric time-direction copy, and destructive emphasis for deadlines due today or earlier, and SHALL omit Start metadata from collapsed task summaries.

#### Scenario: Omit Start from collapsed summaries
- **WHEN** a collapsed task has a Start date or Today horizon in any Tasks list
- **THEN** the task summary presents no Start date, Start-relative copy, Today horizon copy, or Lucide Play icon

#### Scenario: Let list structure communicate Start
- **WHEN** Upcoming groups a task by its Start date or Today groups it by horizon
- **THEN** the list bucket or section communicates that planning context without repeating it in the task's secondary metadata line

#### Scenario: Use a numeral for a one-day deadline offset
- **WHEN** a task row presents a Deadline one day before the owner-local planning date
- **THEN** the relative copy uses the numeral `1` in `1 day ago` and does not spell out `one`

#### Scenario: Emphasize an urgent deadline
- **WHEN** a task row has a Deadline equal to or earlier than the owner-local planning date
- **THEN** the Deadline icon and relative-date copy use the semantic destructive text color

#### Scenario: Keep a future deadline neutral
- **WHEN** a task row has a Deadline later than the owner-local planning date
- **THEN** the Deadline icon and relative-date copy retain the ordinary secondary metadata color

### Requirement: Consistent Tasks list density
The interface SHALL present Tasks list and grouping headings without item-count adornments, SHALL keep every collapsed task at a dense uniform height, and SHALL present optional task metadata in the stable order Area, Project, Reminder, Deadline, and Actionability without resting card decoration or bold typography.

#### Scenario: Present count-free headings
- **WHEN** a Tasks list, section, grouping, search-results, project, area, or checklist heading is presented
- **THEN** the interface presents its descriptive label without a visible or programmatic numeric item count

#### Scenario: Keep closed rows uniform
- **WHEN** a list contains collapsed tasks with different combinations of hierarchy, actionability, deadline, reminder, or other secondary details
- **THEN** every collapsed task row occupies the same 44-pixel height

#### Scenario: Keep secondary details compact
- **WHEN** a collapsed task has one or more secondary details
- **THEN** the interface presents those details in one bounded nonwrapping metadata line without increasing the row height

#### Scenario: Order optional task metadata
- **WHEN** a collapsed task summary presents secondary metadata
- **THEN** its available items appear in the order Area, Project, Reminder, Deadline, and Actionability

#### Scenario: Omit absent task metadata
- **WHEN** any canonical secondary metadata item is unavailable or not applicable to a task
- **THEN** the item is absent without a placeholder and the remaining items preserve their relative canonical order

#### Scenario: Show inherited Area before Project
- **WHEN** a task belongs to a project that belongs to an area
- **THEN** the metadata line presents the parent Area followed by the Project as separate items

#### Scenario: Compress actionability on mobile
- **WHEN** a mobile task row presents Waiting or Rechecking actionability
- **THEN** the metadata line presents that state's established symbol inside a quiet compact chip while preserving the complete actionability name for assistive technology

#### Scenario: Preserve actionable silence
- **WHEN** a task is Actionable
- **THEN** the metadata line presents no actionability symbol or label at any viewport width

#### Scenario: Compress deadlines on mobile
- **WHEN** a mobile task row presents a Deadline
- **THEN** a quiet compact chip presents the Deadline symbol and signed number of owner-planning calendar days from Today followed by `days`, including `0 days` for Today, a positive value such as `4 days` for future work, and a negative value such as `-4 days` for overdue work

#### Scenario: Preserve complete desktop metadata
- **WHEN** the task row renders at or above the standard small breakpoint
- **THEN** Waiting, Rechecking, and Deadline metadata retain their complete established labels and relative-date phrasing without the mobile chip treatment

#### Scenario: Use quiet task titles
- **WHEN** an active, Done, or Trash task row renders its title
- **THEN** the title uses the ordinary interface weight while retaining foreground contrast and the established task-title size

#### Scenario: Use compact internal spacing
- **WHEN** a collapsed task row renders its title, optional metadata, checkbox, source, and actions
- **THEN** it uses compact horizontal and vertical spacing with a slightly reduced leading inset, keeps source and actions controls smaller than the row height and vertically centered, preserves mobile operability, and gives the title and metadata lines a small visible separation without clipping controls or text

#### Scenario: Present resting tasks without cards
- **WHEN** an active, Done, or Trash task is collapsed, resting, unfocused, and unselected
- **THEN** the task row has no visible border, background fill, rounded card boundary, shadow, or gap separating it from the next task row

#### Scenario: Highlight focused and selected tasks consistently
- **WHEN** a collapsed task has whole-task keyboard focus or is selected individually or for a bulk action
- **THEN** the task uses the established quiet selection background highlight without adding an outline or focus ring around the row

#### Scenario: Preserve expanded editing containment
- **WHEN** a user opens a task
- **THEN** the complete editor expands beneath the fixed-height row header inside one quiet rounded background with a subtly increased horizontal content inset that visibly contains the summary and editor without a resting border or shadow

#### Scenario: Preserve planning-project cards
- **WHEN** a primary planning view presents project navigation items alongside compact task rows
- **THEN** the project items retain their distinct card presentation and spacing

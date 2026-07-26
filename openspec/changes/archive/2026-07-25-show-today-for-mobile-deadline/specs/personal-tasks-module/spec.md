## MODIFIED Requirements

### Requirement: Consistent Tasks list density
The interface SHALL present Tasks list and grouping headings without item-count adornments, SHALL keep every collapsed task at a dense uniform height, and SHALL present optional task metadata in the stable order Area, Project, Reminder, Deadline, and Actionability as flat inline content without resting card or chip decoration or bold typography.

#### Scenario: Present count-free headings
- **WHEN** a Tasks list, section, grouping, search-results, project, area, or checklist heading is presented
- **THEN** the interface presents its descriptive label without a visible or programmatic numeric item count

#### Scenario: Keep closed rows uniform
- **WHEN** a list contains collapsed tasks with different combinations of hierarchy, actionability, deadline, reminder, or other secondary details
- **THEN** every collapsed task row occupies the same 44-pixel height

#### Scenario: Keep secondary details compact
- **WHEN** a collapsed task has one or more secondary details
- **THEN** the interface presents those details in one bounded nonwrapping metadata line without increasing the row height

#### Scenario: Present metadata without chips
- **WHEN** any Area, Project, Reminder, Deadline, or Actionability item appears in the second metadata row
- **THEN** it appears without a background fill, border, enclosing corner radius, or chip-specific padding

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
- **THEN** the flat metadata line presents that state's established symbol without its written label while preserving the complete actionability name for assistive technology

#### Scenario: Preserve actionable silence
- **WHEN** a task is Actionable
- **THEN** the metadata line presents no actionability symbol or label at any viewport width

#### Scenario: Compress deadlines on mobile
- **WHEN** a mobile task row presents a Deadline
- **THEN** the flat metadata line presents the Deadline symbol, uses `Today` for a zero owner-planning calendar-day offset, and otherwise presents the signed offset followed by the correctly singular or plural `day` label, including `1 day`, `-1 day`, `4 days`, and `-4 days`

#### Scenario: Preserve complete desktop metadata
- **WHEN** the task row renders at or above the standard small breakpoint
- **THEN** Waiting, Rechecking, and Deadline metadata retain their complete established labels and relative-date phrasing while remaining visually flat

#### Scenario: Use quiet task titles
- **WHEN** an active, Done, or Trash task row renders its title
- **THEN** the title uses the ordinary interface weight while retaining foreground contrast and the established task-title size

## MODIFIED Requirements

### Requirement: Task Row Temporal Metadata
The system SHALL distinguish Start and Due metadata in task rows with semantic Lucide icons, numeric time-direction copy, and destructive emphasis for deadlines due today or earlier.

#### Scenario: Show temporal types
- **WHEN** a task row presents a Start Date or Due Date
- **THEN** Start uses the Lucide Play icon and Due uses the Lucide FlagTriangleRight icon

#### Scenario: Describe a future start
- **WHEN** Upcoming presents a task whose Start Date is two days after the planning date
- **THEN** the row presents the Play icon and the copy `In 2 days` rather than remaining-time copy

#### Scenario: Use a numeral for a one-day offset
- **WHEN** a task row presents a Start Date or Due Date one day before the owner-local planning date
- **THEN** the relative copy uses the numeral `1` in `1 day ago` and does not spell out `one`

#### Scenario: Emphasize an urgent deadline
- **WHEN** a task row has a Due Date equal to or earlier than the owner-local planning date
- **THEN** the Due icon and relative-date copy use the semantic destructive text color

#### Scenario: Keep a future deadline neutral
- **WHEN** a task row has a Due Date later than the owner-local planning date
- **THEN** the Due icon and relative-date copy retain the ordinary secondary metadata color

### Requirement: Concise Task View Presentation
The system SHALL use the active view name, compact self-evident controls, progressive disclosure, natural nearby-date summaries, and small structured day-horizon markers so routine browsing remains uncluttered.

#### Scenario: Name the active view
- **WHEN** any supported Tasks route renders
- **THEN** the primary heading identifies Today, Upcoming, Anytime, Someday, Projects, Project, Area, Templates, Done, or Config at every viewport

#### Scenario: Create an area progressively
- **WHEN** a user activates Add Area from Projects
- **THEN** a title-only BathOS form dialog requests the required area title, disables Save til the title is nonblank, supports Enter submission and complete keyboard traversal, and restores focus to Add Area after close

#### Scenario: Create a project progressively
- **WHEN** a user activates Add Project from Projects
- **THEN** a title-only BathOS form dialog requests the required project title and optional area, disables Save til the title is nonblank, supports Enter submission and complete keyboard traversal, and restores focus to Add Project after close

#### Scenario: Browse projects without setup clutter
- **WHEN** the Projects view is not creating an area or project
- **THEN** it shows compact icon-only Add Area and Add Project controls with nonempty programmatic names and does not render permanent creation fields

#### Scenario: Mark a resolved day horizon
- **WHEN** an active Anytime or deferred Upcoming row has an Inbox, Now, Next, or Later horizon
- **THEN** the row displays compact Lucide iconography with a nonempty accessible name identifying that horizon without repeating a verbose sentence

#### Scenario: Omit an unavailable day-horizon marker
- **WHEN** an undated Anytime row has a null day horizon
- **THEN** the row does not reserve empty marker space or show a decorative icon

#### Scenario: Summarize nearby calendar dates relatively
- **WHEN** a task row displays a Start Date, Deadline, or reminder date that differs from the owner-local planning date by no more than 10 days
- **THEN** the row uses Today, Tomorrow, `1 day ago`, N days ago, or N days left as appropriate

#### Scenario: Mask immediate dates in date controls
- **WHEN** a Start or Deadline input displays the owner-local date immediately before, equal to, or immediately after the planning date
- **THEN** the input respectively presents Yesterday, Today, or Tomorrow instead of an explicit calendar date

#### Scenario: Summarize distant calendar dates compactly
- **WHEN** a displayed date is more than 10 days before or after the owner-local planning date
- **THEN** the row uses a short month and numeric day such as Aug 27

#### Scenario: Arrange the open editor compactly
- **WHEN** a to-do editor is open
- **THEN** Actionability and Organization share one responsive row, temporal controls use one compact responsive row with no full-width reminder container, and Deadline follows on the next row

#### Scenario: Browse Done without archive ceremony
- **WHEN** a user opens Done
- **THEN** the interface shows retained terminal work in reverse terminal order with its terminal reason, date, and one appropriate restore or reopen action

#### Scenario: Create hierarchy progressively
- **WHEN** a user creates an area or project from Projects
- **THEN** compact icon-only controls open title-only keyboard-complete BathOS dialogs and restore trigger focus after close

### Requirement: Consistent Tasks list density
The interface SHALL present count-bearing Tasks list and grouping headings with compact numeric badges and SHALL keep every collapsed to-do row at a dense uniform height independent of its secondary metadata.

#### Scenario: Present grouping totals as badges
- **WHEN** a Tasks list or grouping heading includes an item total
- **THEN** the interface presents the total in an adjacent neutral badge rather than embedding it in parenthetical heading text

#### Scenario: Keep closed rows uniform
- **WHEN** a list contains collapsed to-dos with different combinations of hierarchy, actionability, scheduling, deadline, reminder, or other secondary details
- **THEN** every collapsed to-do row occupies the same 56-pixel height

#### Scenario: Bound secondary metadata
- **WHEN** a collapsed to-do has one or more secondary details
- **THEN** the interface presents those details in one bounded nonwrapping metadata line without increasing the row height

#### Scenario: Use compact internal spacing
- **WHEN** a collapsed to-do row renders its title, optional metadata, checkbox, source, and actions
- **THEN** it uses compact horizontal padding and gaps and keeps the title and metadata lines close enough to maximize visible rows without clipping controls or text

#### Scenario: Preserve expanded editing
- **WHEN** a user opens a to-do
- **THEN** the complete editor expands beneath the fixed-height row header without clipping the editor content

## MODIFIED Requirements

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
- **THEN** the card presents its summary row followed by Title, Notes, Primary Link, Start, Deadline, Actionability, and Organization in DOM, visual, and keyboard order, with each responsive pair preserving that sequence

#### Scenario: Use the task card as the editor boundary
- **WHEN** a to-do editor expands
- **THEN** the form has no redundant top rule or checkbox-column indentation, uses only a small top gap, follows the card's ordinary responsive horizontal padding, and lets its controls fill the resulting content width

#### Scenario: Use shared BathOS form controls
- **WHEN** the expanded editor presents Notes, Actionability, or Organization
- **THEN** Notes matches the standard Input and date-control border and focus treatment while both dropdowns use the shared BathOS Select trigger, popover, selection, and keyboard conventions

#### Scenario: Present the Primary Link as a URL control
- **WHEN** the expanded editor presents Primary Link
- **THEN** it uses a standard full-size URL input with an adjacent named open-link control for its current nonblank destination and does not present a dedicated one-click clear button

#### Scenario: Browse Done without archive ceremony
- **WHEN** a user opens Done
- **THEN** the interface shows retained terminal work in reverse terminal order with its terminal reason, date, and one appropriate restore or reopen action

#### Scenario: Create hierarchy progressively
- **WHEN** a user creates an area or project from Projects
- **THEN** compact icon-only controls open title-only keyboard-complete BathOS dialogs and restore trigger focus after close

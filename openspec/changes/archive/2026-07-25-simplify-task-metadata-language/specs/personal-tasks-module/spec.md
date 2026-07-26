## MODIFIED Requirements

### Requirement: Canonical Tasks Language
The Tasks module SHALL use Tasks as the canonical noun for task records, Summary as the canonical user-facing name for the primary task text field, Ready as the canonical user-facing name for the stored `actionable` state, Deadline for the due-date concept, and Start for the task-start concept throughout user-facing interface copy and command references.

#### Scenario: Present task terminology
- **WHEN** the interface generically names task records, selections, commands, or actions
- **THEN** it uses Task or Tasks rather than To-do, Todo, or To-dos except where external source material must be quoted verbatim

#### Scenario: Present task metadata terminology
- **WHEN** the interface names the task's primary text field or the stored `actionable` actionability state
- **THEN** it respectively uses Summary or Ready without changing the persisted `title` field or `actionable` enum value

#### Scenario: Present planning terminology
- **WHEN** the interface names temporal task metadata
- **THEN** it uses Deadline rather than Due Date and Start rather than Start Date or Task's Start

### Requirement: Concise Task View Presentation
The Tasks module SHALL keep Today, Upcoming, Anytime, Someday, Done, Projects, area, and project views task-focused and compact while presenting full metadata only when it is needed.

#### Scenario: Name the active view
- **WHEN** a user opens a primary Tasks route
- **THEN** the module presents the route's established name as the primary heading without explanatory prose or a duplicate nested page heading

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
- **WHEN** a task row displays a Start or Deadline that differs from the owner-local planning date by no more than 10 days
- **THEN** the row uses Today, Tomorrow, `1 day ago`, N days ago, or N days left as appropriate

#### Scenario: Summarize a reminder by time
- **WHEN** a task row has an active reminder and valid Start planning
- **THEN** the row shows a Lucide reminder bell followed only by the reminder's 12-hour local time with an uppercase AM or PM marker

#### Scenario: Mask immediate dates in date controls
- **WHEN** a Start or Deadline input displays the owner-local date immediately before, equal to, or immediately after the planning date
- **THEN** the input respectively presents Yesterday, Today, or Tomorrow instead of an explicit calendar date

#### Scenario: Keep temporal input hover neutral
- **WHEN** a pointer hovers over an enabled Start or Deadline input
- **THEN** the control retains its ordinary input background while preserving its focus, keyboard, and popover behavior

#### Scenario: Summarize distant calendar dates compactly
- **WHEN** a displayed Start or Deadline is more than 10 days before or after the owner-local planning date
- **THEN** the row uses a short month and numeric day such as Aug 27

#### Scenario: Arrange the open editor compactly
- **WHEN** a task editor is open
- **THEN** the card presents its summary row followed by Summary, Notes, Primary Link, Start, Deadline, Actionability, and Organization controls in DOM, visual, and keyboard order, with each responsive pair preserving that sequence

#### Scenario: Identify drawer fields without visible labels
- **WHEN** the expanded metadata drawer presents its editable controls
- **THEN** it omits repeated visible field labels, presents Summary as the empty primary-text placeholder, uses field-identifying empty-state copy where applicable, and retains a nonempty programmatic name for every control

#### Scenario: Use the task card as the editor boundary
- **WHEN** a task editor expands
- **THEN** the form has no redundant top rule or checkbox-column indentation, uses only a small top gap, follows the card's ordinary responsive horizontal padding, and lets its controls fill the resulting content width

#### Scenario: Use shared BathOS form controls
- **WHEN** the expanded editor presents Notes, Actionability, or Organization
- **THEN** Notes matches the standard Input and date-control border and focus treatment while both dropdowns use the shared BathOS Select trigger, popover, selection, and keyboard conventions

#### Scenario: Present the Primary Link as a URL control
- **WHEN** the expanded editor presents Primary Link
- **THEN** it uses a standard full-size URL input without a dedicated one-click clear button, hides the adjacent activation control while the input is empty, reveals that control as soon as any character is present, and enables activation only for a resolvable supported destination

#### Scenario: Browse Done without archive ceremony
- **WHEN** a user opens Done
- **THEN** the interface shows retained terminal work in reverse terminal order with its terminal reason, date, and one appropriate restore or reopen action

#### Scenario: Create hierarchy progressively
- **WHEN** a user creates an area or project from Projects
- **THEN** compact icon-only controls open title-only keyboard-complete BathOS dialogs and restore trigger focus after close

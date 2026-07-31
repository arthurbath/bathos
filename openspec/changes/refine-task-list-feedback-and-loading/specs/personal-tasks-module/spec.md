## ADDED Requirements

### Requirement: Closed-task completion has an accidental-click grace period
When a user marks a closed ordinary to-do complete from a list, Tasks SHALL show it as checked in place for three seconds before beginning terminal exit motion and persistence.

#### Scenario: User confirms completion by waiting
- **WHEN** the user checks a closed ordinary to-do and does not interact with its completion control for three seconds
- **THEN** the row SHALL remain visibly checked during the grace period
- **AND** Tasks SHALL then run the established completion exit and persistence behavior

#### Scenario: User cancels accidental completion
- **WHEN** the user checks a closed ordinary to-do and checks the same completion control again before three seconds elapse
- **THEN** Tasks SHALL restore the unchecked state in place
- **AND** Tasks SHALL NOT persist a completion mutation

#### Scenario: User opens a task during its grace period
- **WHEN** a user opens a to-do whose closed-row completion grace period is active
- **THEN** Tasks SHALL preserve the checked intent using the established open-editor deferred-completion behavior
- **AND** the user SHALL remain able to uncheck it before closing the editor

### Requirement: Deadline command crosses the overdue boundary
An open deadline picker SHALL advance Control+D from the to-do's selected date by one calendar day, including from yesterday to today, before subsequent commands continue from the current keyboard-focused date.

#### Scenario: Yesterday advances to today
- **WHEN** a to-do's deadline is yesterday, today is the minimum selectable deadline, and the user invokes Control+D after opening the deadline picker
- **THEN** keyboard focus SHALL move to today rather than skipping to tomorrow
- **AND** a subsequent Control+D SHALL move focus to tomorrow

#### Scenario: Arrow navigation remains authoritative
- **WHEN** the user changes the focused calendar date with arrow keys after opening or advancing the deadline picker
- **THEN** the next Control+D SHALL advance one day from that newly focused date

### Requirement: Cacheless task loading does not claim the list is empty
Tasks SHALL distinguish an empty watched-query result that is still fetching from a settled empty list.

#### Scenario: Initial cacheless fetch
- **WHEN** a task-list query has no locally available rows and is still fetching
- **THEN** Tasks SHALL show the task loading indicator
- **AND** Tasks SHALL NOT show a no-tasks empty-state message

#### Scenario: Cached rows refresh
- **WHEN** locally available task rows exist while the watched query is fetching
- **THEN** Tasks SHALL keep those rows visible without replacing them with the initial loading indicator

#### Scenario: Settled empty list
- **WHEN** the watched query has no rows and is no longer loading or fetching
- **THEN** Tasks SHALL show the applicable empty-state message

### Requirement: Legacy task provenance is render-safe
Tasks SHALL render task lists without crashing when a persisted task contains a source-provenance kind that is no longer part of the current typed source vocabulary.

#### Scenario: Unrecognized persisted source kind
- **WHEN** a task row contains a nonempty source kind that the current client does not recognize
- **THEN** Tasks SHALL render the established generic Source presentation
- **AND** the task list SHALL remain usable

### Requirement: Partially upgraded recurrence data is render-safe
Tasks SHALL keep ordinary task lists usable when synchronized recurrence data is temporarily incomplete during a schema transition or cache refresh.

#### Scenario: Recurrence revision lacks a valid prototype snapshot
- **WHEN** synchronized storage exposes a recurrence revision without a valid prototype snapshot
- **THEN** Tasks SHALL skip that invalid recurrence revision and report the parsing failure to developer diagnostics
- **AND** ordinary tasks SHALL continue rendering

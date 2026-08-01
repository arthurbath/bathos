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

### Requirement: Deadline dates are unrestricted and the command crosses the overdue boundary
Tasks SHALL allow a deadline to be selected on any calendar date before, on, or after the current planning date. An open deadline picker SHALL advance Control+D from the to-do's selected date by one calendar day, including from yesterday to today, before subsequent commands continue from the current keyboard-focused date.

#### Scenario: Past and current deadline dates remain available
- **WHEN** a user opens a Deadline picker
- **THEN** dates before the current planning date SHALL remain enabled and selectable
- **AND** the current planning date SHALL remain enabled and selectable

#### Scenario: Yesterday advances to today
- **WHEN** a to-do's deadline is yesterday and the user invokes Control+D after opening the deadline picker
- **THEN** keyboard focus SHALL move to today rather than skipping to tomorrow
- **AND** a subsequent Control+D SHALL move focus to tomorrow

#### Scenario: Arrow navigation remains authoritative
- **WHEN** the user changes the focused calendar date with arrow keys after opening or advancing the deadline picker
- **THEN** the next Control+D SHALL advance one day from that newly focused date

### Requirement: Online startup conceals stale cached task rows
Tasks SHALL distinguish locally available task rows from task rows that have been refreshed by the authoritative service during the current online launch. While an online connected launch awaits its first current-session completed sync, Tasks SHALL show the centered loading indicator instead of revealing the locally cached list.

#### Scenario: Initial cacheless fetch
- **WHEN** a task-list query has no locally available rows and is still fetching
- **THEN** Tasks SHALL show the task loading indicator
- **AND** Tasks SHALL NOT show a no-tasks empty-state message

#### Scenario: Online launch has cached rows
- **WHEN** locally cached task rows are available during an online launch but PowerSync has not completed a sync in the current runtime session
- **THEN** Tasks SHALL show the centered task loading indicator
- **AND** Tasks SHALL NOT reveal the cached rows before current-session freshness is established

#### Scenario: Current-session sync completes
- **WHEN** the authoritative service completes the first sync of the current online runtime session
- **THEN** Tasks SHALL reveal the newly reconciled task list
- **AND** subsequent same-view background refreshes SHALL leave the currently rendered rows visible

#### Scenario: App launches offline
- **WHEN** Tasks launches without browser network connectivity and a locally cached projection is available
- **THEN** Tasks SHALL render the cached rows immediately as its offline fallback

#### Scenario: Online freshness cannot be established promptly
- **WHEN** a download failure occurs or the bounded startup freshness wait expires before a current-session sync completes
- **THEN** Tasks SHALL release the loading gate and render the locally available projection
- **AND** existing synchronization diagnostics SHALL continue to communicate the degraded connection state

#### Scenario: Settled empty list
- **WHEN** the startup freshness gate is released and the watched query has no rows and is no longer loading or fetching
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

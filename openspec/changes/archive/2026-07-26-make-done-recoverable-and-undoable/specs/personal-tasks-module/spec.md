## ADDED Requirements

### Requirement: Reserved forward task history
Tasks SHALL reserve every user-editable forward task mutation before asynchronous persistence or visual departure can make its result unavailable, and SHALL bind the reservation to the accepted mutation identifier before resolving it.

#### Scenario: Undo completion while its write is in flight
- **WHEN** a user completes a task and invokes Command-Z after the task begins leaving its source list but before the completion write returns
- **THEN** Tasks waits for that reserved completion to settle and undoes its exact accepted history event without traversing an older mutation

#### Scenario: Undo completion while history is projecting
- **WHEN** the completion write has returned but its exact history event or completed task snapshot has not yet projected locally
- **THEN** Tasks waits within a bounded interval for both projections and reopens the task into its retained prior planning state

#### Scenario: Match equivalent synchronized terminal timestamps
- **WHEN** a local task projection and its authoritative history snapshot encode the same completion, cancellation, or deletion instant with different valid ISO time-zone spellings
- **THEN** Tasks treats those terminal timestamps as equal for guarded undo while continuing to reject malformed values and genuinely different instants

#### Scenario: Redo an undone completion
- **WHEN** a user undoes a completion and then invokes redo without an intervening forward mutation
- **THEN** Tasks reapplies the exact completion event and returns the task to Done

#### Scenario: Invoke redo with either standard chord
- **WHEN** a user presses Command-Y or Command-Shift-Z on Mac, or Control-Y or Control-Shift-Z on Windows
- **THEN** Tasks captures the command before the browser or an editable field and traverses the same redo cursor

#### Scenario: Reach an unavailable history boundary
- **WHEN** undo or redo has no cursor entry, or its next historical state can no longer satisfy current task invariants
- **THEN** Tasks performs no mutation and shows an ordinary Nothing to Undo or Nothing to Redo toast without destructive styling

#### Scenario: Cancel a failed reservation
- **WHEN** a reserved forward mutation fails before acceptance
- **THEN** Tasks cancels that reservation, restores the visible task state, and does not let a later undo substitute an older or unrelated history event for the failed mutation

#### Scenario: Include all editable task metadata
- **WHEN** a user changes any task field or state that Tasks permits them to edit, including title, notes, link, planning, organization, actionability, Deadline, completion, cancellation, deletion, reopening, or restoration
- **THEN** the accepted mutation participates in the same guarded undo and redo chain

### Requirement: Directly recoverable Done task controls
Done SHALL present retained tasks as recoverable task states with task-native leading controls instead of archive-only rows with detached textual recovery actions.

#### Scenario: Reopen a completed task by unchecking it
- **WHEN** Done presents a completed present task
- **THEN** its leading control is a checked task checkbox, and activating that control reopens the task and returns it to its retained prior planning state

#### Scenario: Reopen a canceled task
- **WHEN** Done presents a canceled present task
- **THEN** its leading control communicates cancellation and activating it reopens the task through the same guarded lifecycle path

#### Scenario: Restore a deleted task from its trash control
- **WHEN** Done presents a recoverably deleted task root
- **THEN** its leading icon-only control shows a trash icon at rest, changes to a restore icon on hover or keyboard focus, and restores the task through the existing hierarchy-safe restore transition when activated

#### Scenario: Preserve task-row interaction in Done
- **WHEN** a retained task appears in Done
- **THEN** its title, source link, terminal date, whole-task focus, selection behavior, and direct recovery control remain operable without exposing permanent deletion

#### Scenario: Retain terminal work for purge
- **WHEN** a task is completed, canceled, or deleted
- **THEN** its existing completion, cancellation, or deletion timestamp remains the Done ordering and 31-day retention timestamp until the task is recovered or purged

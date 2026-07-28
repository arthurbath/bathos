## ADDED Requirements

### Requirement: Widget Completion Lifecycle Parity
The Tasks domain SHALL treat an accepted native widget completion as an ordinary idempotent task completion with the same lifecycle, history, recurrence, and convergence guarantees as completion from the web interface.

#### Scenario: Complete from a widget
- **WHEN** the native widget endpoint accepts a valid request for an owned present open task
- **THEN** the system sets lifecycle to completed, records the authoritative completion time, increments the task revision, appends one supported history event, and lets applicable recurrence processing observe the transition

#### Scenario: Identify the native mutation
- **WHEN** the completion is written
- **THEN** the stored mutation channel identifies the widget boundary, the actor remains the user, and the request carries stable operation and mutation identifiers without storing secret credential material in history

#### Scenario: Converge every client
- **WHEN** a widget completion is accepted centrally
- **THEN** PowerSync projects the ordinary task and history changes to active clients without adding the credential table to its publication

#### Scenario: Reject foreign or ineligible work
- **WHEN** a credential is invalid or its bound owner does not own a present task eligible for completion
- **THEN** the system changes no task, history, recurrence, or credential ownership data

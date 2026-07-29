## ADDED Requirements

### Requirement: Protocol-Specific Primary Link Iconography
Tasks SHALL derive Primary Link iconography consistently for the task row, metadata-editor activation control, and native widget while preserving real-link activation behavior.

#### Scenario: Present a Jira Primary Link
- **WHEN** a task has a `jira:` Primary Link or a recognized Jira HTTP or HTTPS URL
- **THEN** its task row and metadata-editor activation control use Lucide `Zap`, and web URLs open in a new browser context while the Jira protocol is handed to its registered application

#### Scenario: Present an Obsidian Primary Link
- **WHEN** a task has an `obsidian:` Primary Link
- **THEN** its task row and metadata-editor activation control use Lucide `FileText` and hand activation to Obsidian

#### Scenario: Preserve other Primary Link iconography
- **WHEN** a task has a Mail message Primary Link or another supported destination
- **THEN** Mail retains its Mail icon and other destinations retain the canonical generic external-link icon

#### Scenario: Keep the editor and row in parity
- **WHEN** a nonblank Primary Link is visible in an expanded task
- **THEN** the activation control beside the Primary Link input uses the same derived icon as the task summary row

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

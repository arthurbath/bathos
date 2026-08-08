## MODIFIED Requirements

### Requirement: Layered Reminder Delivery
The system SHALL keep the server authoritative for reminder scheduling and logical delivery identity while supporting Web Push, server-driven native push, local native projection, and session-scoped in-app delivery through one idempotent contract.

#### Scenario: Schedule reminder delivery
- **WHEN** a reminder instant is accepted
- **THEN** the server creates one stable logical delivery occurrence and targets each registered delivery endpoint idempotently

#### Scenario: Recover an in-app reminder claim automatically
- **WHEN** an open connected client cannot claim due reminder deliveries
- **THEN** the interface preserves scheduled reminders and previously claimed items, presents no task-list warning or manual retry action, and performs the next automatic claim within one minute or when the tab next becomes visible

#### Scenario: Bound a stalled in-app reminder claim
- **WHEN** a connected client's due-reminder claim does not settle within the configured request window
- **THEN** the client aborts the request, releases its in-flight guard, preserves reminder state, and remains eligible for the next automatic claim

#### Scenario: Inspect current in-app reminder availability
- **WHEN** a user opens Synchronization Details from Tasks Config
- **THEN** the interface reports In-App Reminders as Available when the latest claim did not fail and Delayed while the latest claim failure remains unresolved, without exposing provider or transport diagnostics

#### Scenario: Report a reminder acknowledgement failure
- **WHEN** a visible or notification-opened reminder cannot be acknowledged
- **THEN** the interface reports fixed content-free failure copy, preserves the reminder for retry, and does not expose the underlying provider or transport error

#### Scenario: Read synchronized reminder time precision
- **WHEN** synchronization represents a canonical PostgreSQL reminder time with fractional-second precision
- **THEN** the client accepts it as the original wall-clock intent, renders the Tasks route, and does not reject the reminder projection

#### Scenario: Retry one delivery target
- **WHEN** a provider request is retried for the same occurrence and registered target
- **THEN** the system reuses the target-delivery identifier and does not create another logical delivery

#### Scenario: Open multiple browser tabs
- **WHEN** multiple tabs observe the same due reminder
- **THEN** the tabs share the logical occurrence and do not create duplicate server delivery records

#### Scenario: Deliver on multiple registered devices
- **WHEN** an owner has multiple explicitly registered delivery targets
- **THEN** each target may receive the same logical occurrence once under its own target-delivery identifier

#### Scenario: Delivery capability is unavailable
- **WHEN** notification permission is denied, platform support is missing, or a target expires
- **THEN** the task remains usable and the interface reports degraded reminder capability

#### Scenario: Show only a live-session in-app reminder
- **WHEN** a visible Tasks surface without an enabled deeper notification channel checks for reminders
- **THEN** it may claim only occurrences that became due after the current Tasks session began and before the current check

#### Scenario: Do not resurrect a stale reminder
- **WHEN** a user opens or returns to Tasks after a reminder became due in an earlier session
- **THEN** that surface does not claim or display the older occurrence as an in-app toast

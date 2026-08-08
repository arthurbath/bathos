# tasks-native-reminder-push Specification

## Purpose
TBD - created by archiving change repair-task-reminder-delivery-semantics. Update Purpose after archive.
## Requirements
### Requirement: Installation-scoped native push registration
The system SHALL register native notification tokens only for the authenticated owner and declared iOS or macOS installation, SHALL keep provider tokens outside client synchronization, and SHALL revoke superseded or permanently rejected targets.

#### Scenario: Register an authorized installation
- **WHEN** an authorized iOS or macOS companion receives a valid APNs application token
- **THEN** the server binds one active native-push target to that owner, installation, platform, environment, and exact application topic without exposing the token to PowerSync

#### Scenario: Rotate a native token
- **WHEN** the operating system supplies a replacement token for an existing installation
- **THEN** the server replaces the private token while preserving the stable target identity and cancels no unrelated device target

#### Scenario: Reject cross-owner installation reuse
- **WHEN** an authenticated owner attempts to register an installation already bound to another owner
- **THEN** the server revokes the prior owner binding and reassigns the installation only through the authenticated registration transaction

#### Scenario: Retire a permanent APNs failure
- **WHEN** APNs reports an unregistered, bad, or topic-mismatched device token
- **THEN** the server revokes that target and prevents further reminder attempts to it

### Requirement: Server-driven native reminder delivery
The system SHALL create one idempotent native target-delivery per canonical reminder occurrence and active installation, send an APNs alert at or after the authoritative due instant, and record provider acceptance separately from user acknowledgement.

#### Scenario: Deliver while the app is suspended
- **WHEN** a reminder becomes due while an authorized native companion is suspended or closed
- **THEN** the scheduled server dispatcher submits a Reminder notification with the task Summary and task route to that installation without requiring the embedded web app to run

#### Scenario: Deliver to multiple native devices
- **WHEN** an owner has active iOS and macOS native targets
- **THEN** each target receives at most one provider request for the logical occurrence under its own stable delivery identity

#### Scenario: Retry a transient provider failure
- **WHEN** APNs fails transiently or the dispatcher cannot record an outcome
- **THEN** the target remains eligible for bounded idempotent retry without creating another logical delivery

#### Scenario: Open a native reminder
- **WHEN** the user activates a delivered native reminder
- **THEN** the companion opens the referenced task through the existing trusted Tasks route

#### Scenario: Dismiss on one Apple device
- **WHEN** a user dismisses a reminder on one Apple device
- **THEN** that dismissal remains local and the system does not claim automatic removal of the sister notification on another device


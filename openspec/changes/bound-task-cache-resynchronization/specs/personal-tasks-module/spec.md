## ADDED Requirements

### Requirement: Bounded Disposable Task Cache Recovery
Tasks SHALL persist an installation-scoped automatic recovery circuit breaker so a confirmed disposable-cache failure cannot cause repeated full synchronization downloads across application restarts.

#### Scenario: Permit the first safe automatic replacement
- **WHEN** Tasks detects a recognized recoverable cache failure, the durable upload queue is readable and empty, and the installation has no prior automatic recovery ledger
- **THEN** Tasks records the current application release, recovery time, and source database generation before advancing to one fresh database namespace

#### Scenario: Block another replacement in the same release
- **WHEN** an installation has already committed an automatic cache replacement for the current application release
- **THEN** Tasks preserves the current database namespace, performs no automatic replacement, and presents a recoverable startup failure with a content-free circuit-open diagnostic

#### Scenario: Enforce the rolling cooldown across releases
- **WHEN** an installation starts a different application release fewer than seven days after its last automatic cache replacement
- **THEN** Tasks preserves the current database namespace and performs no automatic replacement

#### Scenario: Permit a later release after cooldown
- **WHEN** the application release differs from the recorded recovery release and at least seven full days have elapsed since that recovery
- **THEN** Tasks may perform one automatic replacement only after the recognized-failure and empty-upload-queue gates pass again

#### Scenario: Preserve local intent when policy state is uncertain
- **WHEN** the recovery ledger or durable upload queue cannot be read or validated
- **THEN** Tasks does not clear, overwrite, retire, or abandon the current database namespace and exposes the recoverable error state for manual intervention

#### Scenario: Replacement construction fails after budget commitment
- **WHEN** Tasks commits the automatic recovery ledger but cannot initialize the replacement database
- **THEN** the recovery remains consumed, the runtime stops automatic replacement attempts, and a restart does not reset the circuit breaker

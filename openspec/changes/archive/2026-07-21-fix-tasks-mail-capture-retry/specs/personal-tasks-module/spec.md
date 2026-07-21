## ADDED Requirements

### Requirement: Deterministic Mail Capture Retry
The system SHALL define a specialized Mail capture's idempotent request identity from caller-controlled task and structured source fields, and SHALL NOT treat service-generated task identity, planning date, or ordering as a caller request difference.

#### Scenario: Retry after generated values change
- **WHEN** an authenticated client retries an accepted Mail capture with the same idempotency UUID and caller-controlled fields after the service would select a different task identifier, planning date, planning order, or hierarchy order
- **THEN** the system returns the original task, structured Mail source, and creation receipt with `already_applied` and creates no additional row or history event

#### Scenario: Reject changed caller content
- **WHEN** an authenticated client reuses an accepted Mail-capture idempotency UUID with a different title, notes, area, source title, account, mailbox, message identifier, deep link, or retirement destination
- **THEN** the system rejects the request and leaves the accepted task, source, and creation history unchanged

#### Scenario: Serialize concurrent exact attempts
- **WHEN** two authenticated calls submit the same idempotency UUID and caller-controlled Mail-capture fields before either call settles
- **THEN** one call creates the task and source, the other resolves to the same accepted task, and the authoritative database contains one task, one source, and one creation event

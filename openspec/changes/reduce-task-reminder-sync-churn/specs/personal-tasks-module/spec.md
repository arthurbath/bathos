## ADDED Requirements

### Requirement: Bounded In-App Reminder Claim Operations
Tasks SHALL preserve authoritative in-app fallback delivery while ensuring that periodic checks with no eligible reminder produce no durable or synchronized operational churn, and SHALL retain successful claim idempotency receipts only until the first hourly retention sweep after they become 24 hours old.

#### Scenario: Check when no reminder is due
- **WHEN** a visible connected fallback surface checks for due reminders and no eligible occurrence exists
- **THEN** the server returns an accepted empty result without creating a claim receipt, creating or refreshing a delivery target, or producing a PowerSync change

#### Scenario: Claim a due reminder idempotently
- **WHEN** a fallback surface checks while one or more eligible reminders are due
- **THEN** the server leases the surface-scoped deliveries, persists one immutable receipt for the request identifier, and returns the same result for an exact retry inside the retention window

#### Scenario: Reject incompatible reuse of a retained claim identifier
- **WHEN** a caller reuses the identifier of a retained nonempty claim with another cutoff or surface
- **THEN** the server rejects the incompatible request without leasing another delivery

#### Scenario: Expire operational claim receipts
- **WHEN** a nonempty claim receipt becomes older than the 24-hour retention threshold
- **THEN** the next hourly retention sweep removes it without changing task content, reminder intent, occurrences, delivery acknowledgement, or future reminder eligibility

#### Scenario: Keep claim receipts out of client synchronization
- **WHEN** a Tasks client establishes or refreshes its PowerSync projection
- **THEN** the claim-receipt table is absent from the publication, owner stream, replication-role grants, and local schema because no client reads or uploads those operational receipts

## MODIFIED Requirements

### Requirement: Project-Free Production Contraction
The production Tasks data model SHALL remove Project and Template persistence only after a verified private backup and exact dependency audits, SHALL delete the authorized disposable records, and SHALL preserve all ordinary non-Project task instances and recurrence prototypes.

#### Scenario: Apply the approved destructive migration
- **WHEN** production matches the exact preflight for Projects, templates, recurrence definitions, future projections, and ordinary instances
- **THEN** the migration removes obsolete Project and Template persistence, converts recurrence prototypes, deletes only authorized disposable or legacy projection rows, and leaves ordinary task instances unchanged

#### Scenario: Fail closed on unexpected dependency content
- **WHEN** an exact Project, Template, or recurrence conversion assertion does not match at migration time
- **THEN** the transaction aborts before deleting or altering owner data

#### Scenario: Synchronize the contracted topology
- **WHEN** the reminder claim-receipt optimization is deployed after the template-free recurrence release
- **THEN** PowerSync publishes and projects exactly 16 approved Tasks tables and no client upload or read path references Projects, Templates, or server-only reminder claim receipts

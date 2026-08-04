## ADDED Requirements

### Requirement: Transactional MCP Task Creation
The generic Tasks `create_task` MCP operation SHALL execute owner validation, idempotency resolution, placement validation, order allocation, task insertion, and creation-receipt readback through one authenticated Supabase database procedure and one database transaction while preserving the existing public tool schema and owner-safe result contract.

#### Scenario: Create a task through one database procedure
- **WHEN** an authenticated MCP client submits a valid new generic task-creation request
- **THEN** the MCP service invokes one transactional database procedure, creates one owned task and one creation event, and returns the accepted receipt with the owner-safe task

#### Scenario: Retry an exact creation concurrently
- **WHEN** two authenticated calls submit the same idempotency UUID and normalized caller-controlled fields before either call settles
- **THEN** one transaction creates the task, the other returns the same task with `already_applied`, and the database retains one task and one creation event

#### Scenario: Retry after later task changes
- **WHEN** an authenticated client retries an exact accepted creation after a later mutation changed the current task
- **THEN** the transaction validates against immutable creation state and returns the current task with the original creation receipt without inserting again

#### Scenario: Reject changed idempotency reuse
- **WHEN** an authenticated client reuses a creation UUID with different normalized caller-controlled content, placement, container, source, Primary Link, or provenance
- **THEN** the database rejects the request and leaves the existing task and history unchanged

#### Scenario: Preserve owner isolation
- **WHEN** an authenticated caller attempts to create in another owner's Area or resolve another owner's creation identity
- **THEN** the database rejects the request through the owner-scoped RPC and RLS boundaries without exposing or changing the other owner's records

#### Scenario: Roll back an unsuccessful creation
- **WHEN** validation, insertion, trigger-authored history, or receipt readback fails within generic task creation
- **THEN** the database transaction retains no partial task or creation event

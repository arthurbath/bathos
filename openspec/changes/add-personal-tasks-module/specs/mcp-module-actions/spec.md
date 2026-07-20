## ADDED Requirements

### Requirement: Personal Tasks MCP Resource Actions
The BathOS MCP server SHALL allow an authenticated user to read and mutate their task areas, projects, headings, templates, to-dos, checklist items, planning values, and supported structured workflow fields.

#### Scenario: Read task data
- **WHEN** an authenticated MCP client requests task data or a defined task view
- **THEN** the server returns only task records owned by the signed-in user

#### Scenario: Read normalized task hierarchy
- **WHEN** an authenticated MCP client requests the complete bounded hierarchy or scopes it to one area, project, heading, or to-do
- **THEN** the server returns the current areas, projects, headings, to-dos, and checklist items with stable relationship identifiers and explicit truncation metadata

#### Scenario: Read one task record
- **WHEN** an authenticated MCP client requests one current task record by type and stable identifier
- **THEN** the server returns that owned record without exposing an owner identifier or a record owned by another user

#### Scenario: Read a defined planning view
- **WHEN** an authenticated MCP client requests Inbox, Today, Upcoming, Anytime, Someday, Logbook, or Trash
- **THEN** the server applies the task-domain lifecycle, disposition, planning-date, time-zone, and ordering rules and returns separately typed project, to-do, or Trash-root results

#### Scenario: Read native templates
- **WHEN** an authenticated MCP client requests active or explicitly archived native templates
- **THEN** the server returns only the signed-in owner's bounded template definitions and their current immutable revisions without exposing owner identifiers

#### Scenario: Create task data
- **WHEN** an authenticated MCP client creates a supported task record with valid structured fields
- **THEN** the server creates the record within the signed-in user's scope and returns its stable identifier and resulting state

#### Scenario: Create a to-do through the narrow MCP contract
- **WHEN** an authenticated MCP client calls `create_task` with a new idempotency key and valid title, planning, container, optional typed-source fields, and an optional supported integration channel
- **THEN** the server creates one open present to-do with immutable declared integration provenance or default `mcp` provenance, an automation actor, stable identifiers, owner-local Today semantics, and append-only creation history

#### Scenario: Create a Mail task atomically
- **WHEN** a verified integration calls `create_mail_task` with complete structured Mail identity, retirement destination, AI-processed content, an optional accessible area, and a new idempotency key
- **THEN** the server atomically creates one daytime Today task with `mail_automation` provenance and one retained Mail source record, then returns the creation receipt and both owner-safe records

#### Scenario: Deduplicate Mail capture by request and source identity
- **WHEN** a verified integration retries the same Mail request UUID or later presents the same owner, account, and message identity with a different request UUID
- **THEN** the server returns the existing task and source without creating duplicate records while rejecting changed data for the same request UUID or conflicting source identity

#### Scenario: Guard Mail source retirement around an external move
- **WHEN** a verified integration is ready to move a retained Mail source and then reports the external result
- **THEN** `begin_mail_retirement` first records a pending state and `resolve_mail_retirement` records only verified retirement or an explicit bounded failure, using optimistic revisions and idempotent receipts for both mutations

#### Scenario: Preserve auditable Mail retirement transitions
- **WHEN** a Mail retirement fails, is retried, and later succeeds
- **THEN** the server retains each accepted owner-scoped lifecycle event, rejects direct authenticated source updates and event inserts, and keeps the retired state terminal

#### Scenario: Reject an idempotency-key payload change
- **WHEN** an MCP client reuses a creation idempotency key with different normalized title, planning, container, or source input
- **THEN** the server rejects the request and neither creates nor changes a task

#### Scenario: Update task data
- **WHEN** an authenticated MCP client updates a supported task record by stable identifier
- **THEN** the server applies the valid state transition only within the signed-in user's scope and returns the resulting state

#### Scenario: Use explicit to-do mutation tools
- **WHEN** an authenticated MCP client edits content or source metadata, moves planning or container placement, schedules dates, or requests a lifecycle or recovery transition
- **THEN** the server exposes `update_task`, `move_task`, `schedule_task`, or `transition_task` respectively instead of a generic record or arbitrary-patch mutation

#### Scenario: Require an optimistic mutation boundary
- **WHEN** an MCP client calls a to-do mutation tool
- **THEN** the request requires the stable to-do identifier, its expected positive revision, and a caller-generated UUID that identifies the logical mutation

#### Scenario: Detect a stale MCP mutation
- **WHEN** the requested expected revision does not match the current owned to-do revision
- **THEN** the server leaves the to-do unchanged and returns a content-free conflict receipt with the current owner-safe state

#### Scenario: Retry an accepted MCP mutation
- **WHEN** an MCP client retries the exact accepted edit, movement, schedule, or lifecycle request with the same mutation identifier
- **THEN** the server resolves the immutable task-history event, returns its original receipt and the current to-do state, and does not append another event

#### Scenario: Retry an accepted recovery mutation
- **WHEN** an MCP client retries the exact accepted recoverable delete or restore request with the same mutation identifier
- **THEN** the server resolves the atomic hierarchy-operation receipt, returns the current to-do state, and does not repeat the hierarchy mutation

#### Scenario: Reject a mutation-key payload change
- **WHEN** an MCP client reuses a mutation identifier for a different task, expected base revision, operation, or normalized payload
- **THEN** the server rejects the request without changing task data

#### Scenario: Return a current-state no-op
- **WHEN** a new MCP mutation identifier requests an already-current lifecycle, recovery, content, placement, or schedule state from the current revision
- **THEN** the server returns a no-op receipt without incrementing the revision or appending task history

#### Scenario: Delete task data recoverably
- **WHEN** an authenticated MCP client requests normal deletion of a supported task record
- **THEN** the server moves the record to the module's recoverable deleted state unless a separately authorized permanent-deletion operation exists

#### Scenario: Delete a to-do hierarchy atomically
- **WHEN** an MCP client recoverably deletes or restores a to-do that has checklist descendants
- **THEN** the server uses one owner-scoped hierarchy operation, validates the complete expected-revision set, and never exposes a partially deleted or restored hierarchy

### Requirement: Structured Task Automation Contract
The BathOS MCP server SHALL expose explicit task fields for actionability, source/origin, templates, scheduling, recurrence, and completion without requiring clients to encode meaning in generic tags or task titles.

#### Scenario: Set structured origin
- **WHEN** an MCP client creates a task from a supported external source or collection integration
- **THEN** the server validates the closed integration channel and typed source reference independently, defaults the channel to `mcp`, and does not require a title prefix

#### Scenario: Set actionability
- **WHEN** an MCP client changes whether a task can be acted on immediately
- **THEN** the server accepts only `actionable` or `waiting`, requires an open present to-do and its current revision, stores the state rather than adding a tag, and returns an idempotent mutation receipt

#### Scenario: Instantiate a template
- **WHEN** an MCP client requests creation from a task or project template
- **THEN** the server requires an explicit anchor and idempotency UUID, fixes the actor and channel to MCP automation, and uses the atomic template-instantiation operation rather than exposing template storage as generic task duplication

### Requirement: Task MCP Mutation Safety
Task MCP mutations SHALL use stable identifiers, enforce ownership and valid state transitions, support idempotent creation where retries are plausible, and produce enough result information to audit the mutation.

#### Scenario: Retry idempotent creation
- **WHEN** an MCP client retries a task-creation request with the same supported idempotency identifier
- **THEN** the server returns the original resulting task instead of creating a duplicate

#### Scenario: Retry creation after later task changes
- **WHEN** an MCP client retries the exact creation request after the resulting task has been edited or transitioned by a later mutation
- **THEN** the server resolves the immutable creation-history receipt, returns the same stable task with its current state, and does not create another task or history event

#### Scenario: Reject invalid owner fields
- **WHEN** an MCP client attempts to assign task ownership to another user
- **THEN** the server rejects or ignores the owner field without creating or modifying data outside the signed-in user's scope

#### Scenario: Reject invalid transition
- **WHEN** an MCP client requests a task state transition that violates the task-domain contract
- **THEN** the server rejects the mutation without partially changing task data

#### Scenario: Return mutation receipt
- **WHEN** an MCP task mutation succeeds
- **THEN** the server returns the client mutation identifier, actor, channel, affected stable identifiers, base and resulting revisions, transition, timestamp, outcome, applicable code, and current owner-safe task state required by the audit contract

#### Scenario: Exclude permanent deletion
- **WHEN** an MCP client requests permanent deletion through the initial task mutation surface
- **THEN** the server rejects the request and leaves recoverably deleted data unchanged

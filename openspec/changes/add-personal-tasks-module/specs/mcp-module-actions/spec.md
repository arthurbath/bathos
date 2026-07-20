## ADDED Requirements

### Requirement: Personal Tasks MCP Resource Actions
The BathOS MCP server SHALL allow an authenticated user to read and mutate their task areas, projects, headings, templates, to-dos, checklist items, planning values, and supported structured workflow fields.

#### Scenario: Read task data
- **WHEN** an authenticated MCP client requests task data or a defined task view
- **THEN** the server returns only task records owned by the signed-in user

#### Scenario: Create task data
- **WHEN** an authenticated MCP client creates a supported task record with valid structured fields
- **THEN** the server creates the record within the signed-in user's scope and returns its stable identifier and resulting state

#### Scenario: Update task data
- **WHEN** an authenticated MCP client updates a supported task record by stable identifier
- **THEN** the server applies the valid state transition only within the signed-in user's scope and returns the resulting state

#### Scenario: Delete task data recoverably
- **WHEN** an authenticated MCP client requests normal deletion of a supported task record
- **THEN** the server moves the record to the module's recoverable deleted state unless a separately authorized permanent-deletion operation exists

### Requirement: Structured Task Automation Contract
The BathOS MCP server SHALL expose explicit task fields for actionability, source/origin, templates, scheduling, recurrence, and completion without requiring clients to encode meaning in generic tags or task titles.

#### Scenario: Set structured origin
- **WHEN** an MCP client creates a task from a supported external source
- **THEN** the server records the source through the task origin contract and does not require a title prefix

#### Scenario: Set actionability
- **WHEN** an MCP client changes whether a task can be acted on immediately
- **THEN** the server validates and stores the defined actionability state rather than adding a tag

#### Scenario: Instantiate a template
- **WHEN** an MCP client requests creation from a task or project template
- **THEN** the server uses the template-instantiation operation rather than exposing template storage as generic task duplication

### Requirement: Task MCP Mutation Safety
Task MCP mutations SHALL use stable identifiers, enforce ownership and valid state transitions, support idempotent creation where retries are plausible, and produce enough result information to audit the mutation.

#### Scenario: Retry idempotent creation
- **WHEN** an MCP client retries a task-creation request with the same supported idempotency identifier
- **THEN** the server returns the original resulting task instead of creating a duplicate

#### Scenario: Reject invalid owner fields
- **WHEN** an MCP client attempts to assign task ownership to another user
- **THEN** the server rejects or ignores the owner field without creating or modifying data outside the signed-in user's scope

#### Scenario: Reject invalid transition
- **WHEN** an MCP client requests a task state transition that violates the task-domain contract
- **THEN** the server rejects the mutation without partially changing task data

#### Scenario: Return mutation receipt
- **WHEN** an MCP task mutation succeeds
- **THEN** the server returns the affected stable identifiers, resulting state, and mutation metadata required by the audit contract


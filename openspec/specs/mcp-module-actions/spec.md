# MCP Module Actions Specification

## Purpose

Define authenticated MCP access to BathOS module data while preserving the signed-in user's existing Supabase RLS boundaries.

## Requirements

### Requirement: Authenticated MCP Module Access
The BathOS MCP server SHALL expose module actions only for an OAuth-authenticated BathOS user, and every action SHALL use that user's Supabase bearer token so existing RLS policies remain authoritative.

#### Scenario: Unauthenticated MCP action
- **WHEN** an MCP client calls a module action without a valid BathOS OAuth user token
- **THEN** the action fails without reading or mutating module data

#### Scenario: Authenticated MCP action
- **WHEN** an MCP client calls a module action with a valid BathOS OAuth user token
- **THEN** the action runs as the signed-in BathOS user and returns structured JSON

### Requirement: Garage MCP Resource Actions
The BathOS MCP server SHALL allow an authenticated user to read, create, update, and delete their Garage vehicles, vehicle services, and vehicle servicing records. Garage servicing records SHALL support service outcome rows associated with the servicing, but receipt file upload and download are out of scope for this capability.

#### Scenario: Read Garage resources
- **WHEN** an authenticated MCP client requests Garage vehicles, services, or servicings
- **THEN** the server returns only records owned by the signed-in user

#### Scenario: Mutate Garage resources
- **WHEN** an authenticated MCP client creates, updates, or deletes a Garage vehicle, service, or servicing
- **THEN** the server applies the mutation only within the signed-in user's Garage scope and returns the resulting record or delete confirmation

### Requirement: Snake MCP Resource Actions
The BathOS MCP server SHALL allow an authenticated household member to read, create, update, and delete Snake household snakes and snake weight records. Snake MCP actions SHALL support the user's accessible Snake household and MUST reject records outside that household.

#### Scenario: Read Snake resources
- **WHEN** an authenticated MCP client requests snakes or weight records
- **THEN** the server returns only records from an accessible Snake household

#### Scenario: Mutate Snake resources
- **WHEN** an authenticated MCP client creates, updates, or deletes a snake or weight record
- **THEN** the server applies the mutation only within the resolved Snake household and returns the resulting record or delete confirmation

### Requirement: Budget MCP Resource Actions
The BathOS MCP server SHALL allow an authenticated household member to read, create, update, and delete Budget household expenses, income streams, budgets, categories, and payment methods. Budget MCP actions SHALL also allow updating household partner settings that are editable in the Budget configuration screen.

#### Scenario: Read Budget resources
- **WHEN** an authenticated MCP client requests Budget household data
- **THEN** the server returns only records from an accessible Budget household

#### Scenario: Mutate Budget records
- **WHEN** an authenticated MCP client creates, updates, or deletes a Budget expense, income stream, budget, category, or payment method
- **THEN** the server applies the mutation only within the resolved Budget household and returns the resulting record or delete confirmation

#### Scenario: Update Budget household settings
- **WHEN** an authenticated MCP client updates Budget partner names or wage-gap settings
- **THEN** the server updates only the resolved Budget household and returns the updated household settings

### Requirement: Wardrobe MCP Resource Actions
The BathOS MCP server SHALL allow an authenticated user to read, create, update, and delete their Wardrobe items.

#### Scenario: Read Wardrobe resources
- **WHEN** an authenticated MCP client requests Wardrobe items
- **THEN** the server returns only items owned by the signed-in user

#### Scenario: Mutate Wardrobe items
- **WHEN** an authenticated MCP client creates, updates, or deletes a Wardrobe item
- **THEN** the server applies the mutation only within the signed-in user's Wardrobe scope and returns the resulting item or delete confirmation

### Requirement: MCP Mutation Guardrails
The BathOS MCP server SHALL reject unsupported resources, unsupported operations, invalid owner fields, and missing required identifiers before issuing a database mutation.

#### Scenario: Unsupported resource
- **WHEN** an MCP client requests a resource not declared by the module action schema
- **THEN** the server rejects the request without issuing a database mutation

#### Scenario: Missing mutation identifier
- **WHEN** an MCP client requests an update or delete operation without the target record id
- **THEN** the server rejects the request without issuing a database mutation
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

#### Scenario: Create task hierarchy records through explicit tools
- **WHEN** an authenticated MCP client calls `create_task_area`, `create_task_project`, `create_task_heading`, or `create_task_checklist_item` with a new idempotency key and valid structured input
- **THEN** the server creates exactly one owner-scoped present record with MCP automation provenance, a server-generated stable identifier, deterministic append ordering, and append-only hierarchy creation history

#### Scenario: Validate a hierarchy creation parent
- **WHEN** an MCP client creates a project within an area, a heading within a project, or a checklist item within a to-do
- **THEN** the server requires the parent to be present, owned by the signed-in user, and open when the parent has a lifecycle, without disclosing an inaccessible record

#### Scenario: Retry hierarchy creation after later changes
- **WHEN** an MCP client retries an exact hierarchy-creation request after the resulting record has changed
- **THEN** the server resolves the immutable hierarchy creation event, returns its original receipt and the current owner-safe record, and does not create another record or event

#### Scenario: Reject a changed hierarchy creation retry
- **WHEN** an MCP client reuses a hierarchy-creation idempotency key for another record type or changed normalized input
- **THEN** the server rejects the request without creating or changing hierarchy data

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

#### Scenario: Update hierarchy content through explicit tools
- **WHEN** an authenticated MCP client calls `update_task_area`, `update_task_project`, `update_task_heading`, or `update_task_checklist_item` with supported content or checklist-completion input
- **THEN** the server updates only those allowlisted fields on an owned present record and requires an open parent before changing a heading or checklist item

#### Scenario: Require an optimistic hierarchy-update boundary
- **WHEN** an MCP client calls a hierarchy content-update tool
- **THEN** the request requires the stable record identifier, its expected positive revision, and a caller-generated mutation UUID, while owner, raw revision, lifecycle, disposition, order, and arbitrary metadata fields remain unavailable

#### Scenario: Retry an accepted hierarchy update
- **WHEN** an MCP client retries the exact accepted hierarchy content update with the same mutation UUID
- **THEN** the server resolves the immutable hierarchy-history event, returns its original receipt and the current owner-safe record, and does not write again

#### Scenario: Reject a stale or changed hierarchy update
- **WHEN** a hierarchy update has a stale expected revision or reuses a mutation UUID with changed record, revision, or normalized input
- **THEN** a stale request returns a content-free conflict receipt and current owner-safe state, while a changed retry is rejected without changing hierarchy data

#### Scenario: Return a current hierarchy no-op
- **WHEN** a new hierarchy mutation UUID requests content or checklist completion that is already current
- **THEN** the server returns a content-free no-op receipt without changing the revision, completion timestamp, or append-only hierarchy history

#### Scenario: Transition hierarchy lifecycle and recovery explicitly
- **WHEN** an authenticated MCP client calls `transition_task_hierarchy`
- **THEN** the tool completes, cancels, or reopens only a project, or recoverably deletes or restores one area, project, heading, or checklist item, without exposing generic lifecycle fields, physical deletion, or to-do behavior already owned by `transition_task`

#### Scenario: Derive the atomic hierarchy revision set on the server
- **WHEN** an MCP client requests a hierarchy lifecycle or recovery operation with the stable root identifier, current positive root revision, and logical mutation UUID
- **THEN** Postgres derives the complete owner-scoped candidate revision set, substitutes the caller's expected root revision, and applies the operation only when that exact authoritative set remains current

#### Scenario: Protect project descendants explicitly
- **WHEN** an MCP client completes or cancels a project
- **THEN** the default `reject` policy returns a content-free rejection while open descendant to-dos remain, an explicit `cascade` applies the terminal transition atomically to the project and open descendants, and reopening changes only the project

#### Scenario: Retry a hierarchy lifecycle or recovery operation
- **WHEN** an MCP client retries the exact hierarchy transition with the same mutation UUID after the operation or root has changed
- **THEN** the server returns the immutable original operation receipt and current owner-safe root when it remains available without repeating the mutation, while changed reuse is rejected

#### Scenario: Return safe hierarchy transition outcomes
- **WHEN** a hierarchy lifecycle or recovery request is already current, stale, rejected by descendant policy, or accepted
- **THEN** the server returns a no-op, conflict, rejected, or accepted receipt respectively, never exposes a partial hierarchy, and keeps permanent deletion outside the MCP schema

#### Scenario: Move a project through an explicit tool
- **WHEN** an authenticated MCP client calls `move_task_project` with the current project revision and a new area, planning placement, or both
- **THEN** the server validates the owned present area, project lifecycle, owner-local Today date, calendar range, and supported placement, appends generated structural and planning order keys when their scopes change, and never accepts raw order keys

#### Scenario: Schedule a project through an explicit tool
- **WHEN** an authenticated MCP client calls `schedule_task_project` with the current project revision and a start-date or deadline change
- **THEN** the server validates date-only calendar values and range, activates scheduled Someday work into Anytime, preserves valid project placement, and never exposes lifecycle or arbitrary project fields through the scheduling operation

#### Scenario: Retry an accepted project movement or schedule
- **WHEN** an MCP client retries the exact accepted project movement or scheduling request with the same mutation UUID after the current project has changed
- **THEN** the server validates the normalized historical before-and-after states, returns the immutable hierarchy-history receipt and current owner-safe project without another write, and rejects changed reuse or a key used by another task or hierarchy operation

#### Scenario: Return safe project mutation outcomes
- **WHEN** a project movement or schedule request is already current, stale, deleted, or terminal
- **THEN** the server returns a content-free no-op or revision conflict when applicable, otherwise rejects the invalid state, and never changes append-only history for an unaccepted request

#### Scenario: Reorder through explicit direction-based tools
- **WHEN** an authenticated MCP client calls `reorder_task` or `reorder_task_hierarchy` with a stable record identifier, current positive revision, logical mutation UUID, supported order scope, and `up` or `down`
- **THEN** the server reorders only that present open record within its exact current planning section or structural peer collection and never accepts a raw order key or destination index

#### Scenario: Derive a deterministic reorder scope
- **WHEN** an MCP client reorders a planning record
- **THEN** the request identifies the supported planning view and explicit planning date, Today remains section-scoped, Upcoming remains start-date-scoped, and the server reads the complete owner-scoped peer collection through ordered pagination before generating the replacement fractional key

#### Scenario: Preserve independent ordering dimensions
- **WHEN** an MCP client reorders a to-do or project structurally or within a planning view
- **THEN** the server changes only `hierarchy_order_key` or structural `order_key` for hierarchy order and only the planning `order_key` or `planning_order_key` for planning order, leaving the other dimension unchanged

#### Scenario: Return safe reorder outcomes
- **WHEN** a reorder reaches a collection boundary, uses a stale expected revision, retries an exact accepted request, or reuses its mutation UUID with changed scope, direction, record, or revision
- **THEN** the server returns a content-free no-op at the boundary, a content-free conflict for stale state, the immutable original history receipt and current owner-safe record for an exact retry, or rejects changed reuse without writing another revision or history event

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

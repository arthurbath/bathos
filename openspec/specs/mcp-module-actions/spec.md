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

### Requirement: MCP Start And Today Horizon Exclusivity
The Tasks MCP boundary SHALL expose and accept only canonical mutually exclusive future Start and Today horizon planning forms.

#### Scenario: Assign a Today horizon through MCP
- **WHEN** an authenticated client assigns Inbox, Now, Next, or Later
- **THEN** the server clears future Start, stores the horizon, and returns the canonical Today planning state

#### Scenario: Reject a conflicting planning payload
- **WHEN** a client attempts to persist both a future Start and a Today horizon
- **THEN** the server normalizes the explicit future Start by clearing the horizon or rejects the ambiguous payload without retaining both values

#### Scenario: Capture processed Mail in Today Inbox
- **WHEN** the verified Mail integration atomically creates a task from one successfully processed message
- **THEN** the server creates one active Anytime task with no future Start and the Inbox horizon while preserving the integration's idempotent source record and final AI-processed content

### Requirement: Personal Tasks MCP Resource Actions
The BathOS MCP server SHALL let an authenticated user read and mutate their heading-free task hierarchy, templates, to-dos, checklists, future-only Starts, mutually exclusive Today horizons, reminder time, Done recovery state, and supported structured workflow fields under the current Tasks domain rules.

#### Scenario: Read task data
- **WHEN** an authenticated MCP client requests task data or a defined task view
- **THEN** the server returns only task records owned by the signed-in user

#### Scenario: Read one task record
- **WHEN** an authenticated MCP client requests one current task record by supported type and stable identifier
- **THEN** the server returns that owned record without exposing an owner identifier or a record owned by another user

#### Scenario: Read native templates
- **WHEN** an authenticated MCP client requests active or explicitly archived native templates
- **THEN** the server returns only the signed-in owner's bounded template definitions and their current immutable revisions without exposing owner identifiers

#### Scenario: Retry hierarchy creation after later changes
- **WHEN** an MCP client retries an exact hierarchy-creation request after the resulting record has changed
- **THEN** the server resolves the immutable hierarchy creation event, returns its original receipt and the current owner-safe record, and does not create another record or event

#### Scenario: Reject a changed hierarchy creation retry
- **WHEN** an MCP client reuses a hierarchy-creation idempotency key for another record type or changed normalized input
- **THEN** the server rejects the request without creating or changing hierarchy data

#### Scenario: Create a Mail task atomically
- **WHEN** a verified integration calls `create_mail_task` with complete structured Mail identity, retirement destination, AI-processed content, optional accessible area, and a new idempotency key
- **THEN** the server atomically creates one undated Anytime task with Today Inbox horizon, `mail_automation` provenance, one editable Primary Link initialized from the deep link, and one retained Mail source, then returns the creation receipt and owner-safe records

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
- **WHEN** an authenticated MCP client calls `update_task_area`, `update_task_project`, or `update_task_checklist_item` with supported content or checklist-completion input
- **THEN** the server updates only those allowlisted fields on an owned present record and requires an open parent before changing a checklist item

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

#### Scenario: Derive the atomic hierarchy revision set on the server
- **WHEN** an MCP client requests a hierarchy lifecycle or recovery operation with the stable root identifier, current positive root revision, and logical mutation UUID
- **THEN** Postgres derives the complete owner-scoped candidate revision set, substitutes the caller's expected root revision, and applies the operation only when that exact authoritative set remains current

#### Scenario: Retry a hierarchy lifecycle or recovery operation
- **WHEN** an MCP client retries the exact hierarchy transition with the same mutation UUID after the operation or root has changed
- **THEN** the server returns the immutable original operation receipt and current owner-safe root when it remains available without repeating the mutation, while changed reuse is rejected

#### Scenario: Return safe hierarchy transition outcomes
- **WHEN** a hierarchy lifecycle or recovery request is already current, stale, rejected by descendant policy, or accepted
- **THEN** the server returns a no-op, conflict, rejected, or accepted receipt respectively, never exposes a partial hierarchy, and keeps permanent deletion outside the MCP schema

#### Scenario: Reorder through explicit direction-based tools
- **WHEN** an authenticated MCP client calls `reorder_task` or `reorder_task_hierarchy` with a stable record identifier, current positive revision, logical mutation UUID, supported order scope, and `up` or `down`
- **THEN** the server reorders only that present open record within its exact current planning section or structural peer collection and never accepts a raw order key or destination index

#### Scenario: Derive a deterministic reorder scope
- **WHEN** an MCP client reorders a planning record
- **THEN** the request identifies the supported planning view and explicit planning date, Today remains section-scoped, Upcoming remains start-date-scoped, and the server reads the complete owner-scoped peer collection through ordered pagination before generating the replacement fractional key

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

#### Scenario: Reject a retired view
- **WHEN** an MCP client requests Inbox, Logbook, or Trash
- **THEN** schema validation rejects the retired value and identifies the current Today or Done vocabulary

#### Scenario: Create a to-do through the narrow contract
- **WHEN** an authenticated MCP client calls `create_task` with a new idempotency key, valid title, optional planning and single-value container input, optional typed source, and optional supported integration channel
- **THEN** the server creates exactly one open present to-do with declared or MCP provenance, stable identifiers, append-only history, no start date, and Today Next as its default planning placement

#### Scenario: Deduplicate capture
- **WHEN** a client retries an exact creation request or Mail source identity
- **THEN** the server returns the existing task and source without creating duplicates and rejects changed reuse of the idempotency key

#### Scenario: Move day horizon explicitly
- **WHEN** a client moves Anytime work to Inbox, Now, Next, or Later
- **THEN** the server keeps destination Anytime, clears any future Start, changes the supported Today horizon, updates relevant ordering, and returns a revision-checked receipt

#### Scenario: Clear a start date explicitly
- **WHEN** a client clears an Anytime item's start date
- **THEN** the server cancels its active reminder, retains or clears its day horizon according to the explicit active placement, and keeps the item in Anytime

#### Scenario: Schedule future work
- **WHEN** a client assigns a future Start
- **THEN** the server places the work in Anytime, clears its Today horizon, includes it in Upcoming until the owner-local date, and preserves valid container and deadline state even when the deadline is earlier

#### Scenario: Reject a nonfuture Start Date
- **WHEN** a client assigns today or an earlier date as Start Date
- **THEN** the server rejects the request without changing task data and directs the client to an active day horizon instead

#### Scenario: Edit a Primary Link
- **WHEN** an MCP client creates or updates a to-do with an optional Primary Link
- **THEN** the server stores the literal shortcut through the narrow content contract, includes it in history and owner-safe reads, and does not modify structured source identity

#### Scenario: Retry an accepted mutation
- **WHEN** a client retries an exact accepted mutation identifier after current state changes
- **THEN** the server returns the immutable original receipt and current owner-safe state without another write

#### Scenario: Detect stale or changed mutations
- **WHEN** expected revision is stale or a mutation identifier is reused with changed normalized input
- **THEN** the server returns a safe conflict or rejects changed reuse without modifying task data

#### Scenario: Preserve independent ordering
- **WHEN** a client reorders work structurally, in Anytime, or in one Today section
- **THEN** the server changes only the relevant hierarchy or planning order and never changes day horizon as a side effect

#### Scenario: Keep purge server-authoritative
- **WHEN** Done work reaches its automatic expiry boundary
- **THEN** no MCP tool can defer the purge, resurrect purged content, or enumerate another owner's terminal records

### Requirement: Structured Task Automation Contract
The BathOS MCP server SHALL expose explicit task fields for three-state actionability, source/origin, templates, future-only scheduling, mutually exclusive Today horizons, reminders, recurrence, and completion without requiring clients to encode meaning in generic tags or task titles.

#### Scenario: Set structured origin
- **WHEN** an MCP client creates a task from a supported external source or collection integration
- **THEN** the server validates the closed integration channel and typed source reference independently, defaults the channel to `mcp`, and does not require a title prefix

#### Scenario: Set actionability
- **WHEN** an MCP client changes how an open present task can become actionable
- **THEN** the server accepts only `actionable`, `waiting`, or `rechecking`, stores the state rather than adding a tag, and returns an idempotent mutation receipt

#### Scenario: Set a structured day horizon
- **WHEN** an MCP client creates, moves, or schedules Anytime work with `inbox`, `now`, `next`, or `later`
- **THEN** the server stores the active Today horizon, clears any future Start, and returns it in owner-safe planning state

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

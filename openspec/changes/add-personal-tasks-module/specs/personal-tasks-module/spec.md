## ADDED Requirements

### Requirement: Private-First Task Module
The system SHALL provide a single-owner task module whose records are accessible only to the signed-in BathOS user unless a later specification explicitly adds sharing.

#### Scenario: Access owned task data
- **WHEN** an authenticated user opens the task module
- **THEN** the system returns only task data owned by that user

#### Scenario: Reject another user's task data
- **WHEN** a client attempts to read or mutate task data owned by another user
- **THEN** the system rejects the operation through the task module's RLS and service boundaries

#### Scenario: Synchronize owned task data
- **WHEN** a client subscribes to task synchronization
- **THEN** the synchronization service downloads only rows whose owner matches the authenticated user and mirrors the ownership boundary enforced by RLS

#### Scenario: Change accounts on one installation
- **WHEN** one owner signs out and another owner signs in on the same client installation
- **THEN** the client clears or rebinds its local task projection before rendering the new owner's task data and never exposes the prior owner's cached rows

### Requirement: Core Task Organization
The system SHALL organize active work through Inbox, areas, projects, headings, to-dos, and checklist items without requiring generic tags.

#### Scenario: Capture unprocessed work
- **WHEN** a user creates a to-do without assigning an organizational destination or schedule
- **THEN** the system places the to-do in Inbox

#### Scenario: Organize work in a project
- **WHEN** a user places a to-do under a project and optional heading
- **THEN** the to-do appears in that hierarchy and retains its stable identity

#### Scenario: Organize ongoing responsibility
- **WHEN** a user places a project or loose to-do in an area
- **THEN** the system includes the item in that area's active work

### Requirement: Date-Based Planning Views
The system SHALL derive Today, This Evening, Upcoming, Anytime, Someday, and Logbook from task state, start dates, deadlines, and completion state.

#### Scenario: Plan work for today
- **WHEN** a user assigns an open to-do to today
- **THEN** the system includes it in Today and allows the user to place it in the This Evening section

#### Scenario: Defer work to a future date
- **WHEN** a user assigns a future start date to a to-do or project
- **THEN** the system includes it in Upcoming and withholds it from active Anytime work until its start date arrives

#### Scenario: Leave work actionable without a date
- **WHEN** an open to-do has no future start date and is not assigned to Someday
- **THEN** the system includes it in Anytime

#### Scenario: Store an uncommitted possibility
- **WHEN** a user assigns a to-do or project to Someday
- **THEN** the system withholds it from Today, Upcoming, and Anytime until the user changes its planning state

#### Scenario: Complete or cancel work
- **WHEN** a user completes or cancels a to-do or project
- **THEN** the system removes it from active planning views and retains it in Logbook according to the history contract

### Requirement: Tagless Structured Semantics
The system SHALL represent workflow meaning through explicit structured concepts and SHALL NOT require generic tags or title parsing as canonical task data.

#### Scenario: Mark work as not immediately actionable
- **WHEN** a user applies a defined non-actionable state to an open to-do
- **THEN** the system stores that state explicitly and can include or exclude the to-do from relevant views without a tag

#### Scenario: Record task origin
- **WHEN** a to-do is created from a defined source such as manual entry, Mail, a webpage, or an automation
- **THEN** the system stores the source as structured origin metadata without requiring an emoji or text prefix

#### Scenario: Render an origin indicator
- **WHEN** the interface displays a task whose origin has a configured indicator
- **THEN** the interface derives that presentation from origin metadata rather than parsing the task title

### Requirement: Native Templates
The system SHALL support reusable to-do and project templates as definitions that are separate from active task records.

#### Scenario: Create work from a template
- **WHEN** a user instantiates a to-do or project template
- **THEN** the system creates independent active records and retains a reference to the source template

#### Scenario: Edit an instantiated task
- **WHEN** a user edits work created from a template
- **THEN** the system does not modify the source template unless the user explicitly chooses a template-editing action

#### Scenario: Keep templates out of active views
- **WHEN** a template definition exists but has not been instantiated
- **THEN** the system excludes the definition from Inbox, Today, Upcoming, Anytime, Someday, and Logbook

### Requirement: Scheduling and Recurrence Integrity
The system SHALL distinguish start dates, deadlines, reminder timestamps, recurrence definitions, and recurrence occurrences.

#### Scenario: Start date and deadline coexist
- **WHEN** a to-do has both a start date and a later deadline
- **THEN** the system uses the start date to control when the to-do becomes active and retains the deadline as the completion boundary

#### Scenario: Generate a recurring occurrence
- **WHEN** a recurrence definition becomes due to produce work
- **THEN** the system creates no more than one occurrence for that recurrence event

#### Scenario: Complete an occurrence
- **WHEN** a user completes one occurrence of recurring work
- **THEN** the system preserves the recurrence definition and evaluates the next occurrence according to its recurrence rule

#### Scenario: Interpret dates across time changes
- **WHEN** a user's time zone or daylight-saving offset changes
- **THEN** date-only planning values remain assigned to their intended local dates and reminder timestamps follow the documented reminder policy

### Requirement: Stable Manual Ordering
The system SHALL preserve intentional manual ordering across saves, refreshes, offline operation, and synchronization.

#### Scenario: Reorder active work
- **WHEN** a user moves an item within an ordered task view
- **THEN** the system saves the new order without changing unrelated items

#### Scenario: Restore after asynchronous save
- **WHEN** a reorder is saved asynchronously and the view refreshes
- **THEN** the interface retains the user's committed order without visible reversion or scroll disruption

#### Scenario: Resolve concurrent ordering changes
- **WHEN** two clients change overlapping ordered items before synchronization completes
- **THEN** the system applies the documented deterministic conflict policy and does not lose or duplicate an item

#### Scenario: Concurrently insert items into the same order gap
- **WHEN** two clients assign the same fractional order key to different items before synchronization
- **THEN** both items remain present and every client derives the same total order by sorting on order key and then stable item identifier

#### Scenario: Concurrently reorder the same item
- **WHEN** two clients reorder the same item from the same base revision
- **THEN** the first accepted revision remains authoritative and the stale reorder produces a conflict receipt rather than silently overwriting the accepted order

### Requirement: Offline Task Operation
The system SHALL allow core task work to continue during temporary network loss and SHALL reconcile valid local changes when connectivity returns.

#### Scenario: Create work offline
- **WHEN** the user creates a to-do while the client is offline
- **THEN** the client stores the to-do durably, displays it immediately, and queues it for synchronization

#### Scenario: Complete work offline
- **WHEN** the user completes a to-do while the client is offline
- **THEN** the client retains the completion across restart and synchronizes it when connectivity returns

#### Scenario: Reconnect after multiple changes
- **WHEN** a client reconnects after local and remote task changes occurred
- **THEN** the system reconciles the changes according to the documented conflict rules and reports any state it cannot reconcile safely

#### Scenario: Preserve the durable mutation queue
- **WHEN** a client restarts while one or more mutations have not reached the server
- **THEN** the client retains the queued mutations, exposes their count, and retries them without creating duplicate logical tasks

### Requirement: Deterministic Task Reconciliation
The system SHALL use stable task identifiers and optimistic integer revisions so stale task mutations are detected, reported, and resolved to an authoritative server state.

#### Scenario: Upload a current task revision
- **WHEN** a queued task mutation increments the server's current revision by one
- **THEN** the server accepts the mutation and the client removes it from the durable queue

#### Scenario: Reject a stale task revision
- **WHEN** another client has already advanced the task beyond a queued mutation's base revision
- **THEN** the stale mutation does not overwrite the server row, the client records a content-free conflict receipt, and the local task converges to the authoritative server row

#### Scenario: Reconcile completion against a stale edit
- **WHEN** one client completes a task and another client uploads an edit based on the same earlier revision
- **THEN** the first accepted mutation remains authoritative and the later stale mutation follows the conflict-receipt behavior

### Requirement: Actionable Synchronization Diagnostics
The system SHALL expose synchronization state without logging task content, including durable queue depth, last successful synchronization, upload and download activity or errors, and conflict receipts.

#### Scenario: Upload path fails while the client is otherwise active
- **WHEN** the task upload API is unavailable but the application and synchronization stream remain active
- **THEN** the client retains the queued mutation and reports the upload failure separately from its general connection state

### Requirement: Recoverable History
The system SHALL provide undo, recoverable deletion, history, backup, and export behavior before the module is considered replacement-ready.

#### Scenario: Undo a recent change
- **WHEN** a user invokes undo for a supported recent task mutation
- **THEN** the system restores the prior state and synchronizes the restoration as a new valid mutation

#### Scenario: Delete a task
- **WHEN** a user deletes a to-do or project through the normal interface
- **THEN** the system moves it to a recoverable deleted state rather than immediately erasing it

#### Scenario: Restore deleted work
- **WHEN** a user restores a recoverably deleted item
- **THEN** the system returns the item and its supported descendants to an appropriate active or historical location

#### Scenario: Export task data
- **WHEN** a user requests an export
- **THEN** the system produces a portable representation of the user's task data without requiring direct database access

### Requirement: Keyboard-First Daily Operation
The system SHALL support efficient keyboard operation for high-frequency capture, navigation, editing, scheduling, movement, completion, and search workflows.

#### Scenario: Navigate without a pointer
- **WHEN** a keyboard user moves through a task view
- **THEN** focus remains visible and predictable across every interactive control

#### Scenario: Complete selected work
- **WHEN** a user invokes the completion command on the focused to-do
- **THEN** the system completes that to-do and moves focus according to the documented next-item behavior

#### Scenario: Open global quick entry on Mac
- **WHEN** the user invokes the configured Raycast task-entry hotkey
- **THEN** Raycast presents a task capture interface without requiring the BathOS browser tab to be focused

### Requirement: Parallel Use with Things
The system SHALL support indefinite parallel use without requiring the user to migrate, delete, or modify the existing Things library.

#### Scenario: Begin using the BathOS module
- **WHEN** the user creates task data in BathOS during development
- **THEN** the system does not write to or delete data from Things

#### Scenario: Perform discovery inventory
- **WHEN** an authorized discovery process reads Things through AppleScript
- **THEN** the process remains read-only, bounded, and excludes private task content from the public repository

#### Scenario: Defer migration
- **WHEN** the BathOS module is not yet replacement-ready
- **THEN** no implementation task requires a Things import or source-of-truth switch

### Requirement: Original Product Expression
The system SHALL use original product naming, visual language, copy, assets, and detailed interactions while preserving the functional planning principles selected for the BathOS module.

#### Scenario: Design a familiar planning concept
- **WHEN** the module implements a concept also present in Things
- **THEN** the implementation uses BathOS conventions and original expression rather than copying Cultured Code branding or assets

### Requirement: Module Isolation
The task module SHALL remain removable without importing code from another BathOS module or requiring another module's data.

#### Scenario: Use shared BathOS infrastructure
- **WHEN** the task module needs authentication, layout, UI primitives, or general utilities
- **THEN** it uses shared platform, component, or library surfaces rather than importing another module

#### Scenario: Remove the task module
- **WHEN** the task module's files, routes, launcher entry, and `tasks_` database objects are removed
- **THEN** unrelated BathOS modules continue to function

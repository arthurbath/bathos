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

### Requirement: Production Task Synchronization
The system SHALL deploy remote task synchronization only through an explicitly approved topology whose download boundary mirrors task RLS and whose secrets remain outside the public client repository.

#### Scenario: Provision production synchronization
- **WHEN** a production PowerSync service is approved for parallel use
- **THEN** it uses direct encrypted database replication, a least-privilege task-only role and publication, owner-scoped Sync Streams, Supabase Auth verification, managed secrets, and a public HTTPS client endpoint

#### Scenario: Validate production synchronization before personal use
- **WHEN** the production service, publication, stream rules, authentication, and client endpoint are configured
- **THEN** a synthetic owner proves cross-client download, queued upload, conflict handling, restart recovery, owner isolation, and cleanup before the user stores personal task content

#### Scenario: Evolve the synchronized task projection
- **WHEN** a nonlocal task collection is added to or removed from the client schema
- **THEN** the production and disposable streams, production and disposable publications, replication-role grants, database preflight, replica identity, RLS, and regression test change together as one exact owner-scoped set

#### Scenario: Exclude server-only task secrets
- **WHEN** the synchronized task projection is configured
- **THEN** it excludes Web Push subscription material, Mail source lifecycle records, private operational context, and every non-Tasks module table

#### Scenario: Operate without an approved remote topology
- **WHEN** no production PowerSync endpoint is configured
- **THEN** the module identifies itself as local-only, preserves that installation's durable task data, and does not imply cross-device or MCP convergence

#### Scenario: Preserve the promotion boundary
- **WHEN** a free or single-instance topology is used for parallel evaluation
- **THEN** the system does not treat that topology as authoritative until uptime, monitoring, backup, upgrade, outage, and recovery behavior pass a later explicit review

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

#### Scenario: Keep project membership canonical
- **WHEN** a to-do belongs to a project whose area changes
- **THEN** the to-do remains in the project, derives its area from that project, and does not receive a competing direct area assignment

#### Scenario: Organize a project with headings
- **WHEN** a user places a to-do under a heading in a project
- **THEN** the heading belongs to that same project and the system rejects cross-project or cross-owner hierarchy references

#### Scenario: Move a to-do between containers
- **WHEN** a user moves a to-do to an area, project, heading, or no container
- **THEN** the system clears incompatible parent references, preserves the to-do's stable identity and planning state, and assigns an order within the new hierarchy scope

#### Scenario: Maintain a checklist
- **WHEN** a user adds, edits, reorders, completes, reopens, or recoverably removes a checklist item
- **THEN** the checklist item remains owned by exactly one to-do and its completion state remains independent from the parent to-do's lifecycle

#### Scenario: Order hierarchy independently from planning views
- **WHEN** a user reorders an area, project, heading, project to-do, loose area to-do, or checklist item
- **THEN** the system changes only the selected item's order within that hierarchy scope and does not change its order in Today, Anytime, Someday, or another planning view

### Requirement: Date-Based Planning Views
The system SHALL derive Today, This Evening, Upcoming, Anytime, Someday, and Logbook from task state, start dates, deadlines, and completion state.

#### Scenario: Plan work for today
- **WHEN** a user assigns an open to-do to today
- **THEN** the system records the owner's current planning date, includes the to-do in Today, and allows the user to place it in the This Evening section

#### Scenario: Carry unfinished work across midnight
- **WHEN** an open Today to-do remains unfinished after its assigned planning date
- **THEN** the system keeps it visible in an Unfinished section until the user completes, moves, or explicitly reschedules it

#### Scenario: Reschedule unfinished work
- **WHEN** a user reschedules unfinished work for Today, This Evening, or Tomorrow
- **THEN** the system records the selected owner-local calendar date, places Today work in the selected Today section, and moves Tomorrow work into Upcoming

#### Scenario: Defer work to a future date
- **WHEN** a user assigns a future start date to a to-do or project
- **THEN** the system includes it in Upcoming and withholds it from active Anytime work until its start date arrives

#### Scenario: Leave work actionable without a date
- **WHEN** an open present to-do is assigned to Anytime and has no future start date
- **THEN** the system includes it in Anytime and excludes Inbox, Today, and Someday work from that view

#### Scenario: Temporarily defer Anytime work
- **WHEN** an Anytime to-do receives a future start date
- **THEN** the system withholds it from Anytime, includes it in Upcoming, and returns it to Anytime automatically when its owner-local start date arrives

#### Scenario: Store an uncommitted possibility
- **WHEN** a user assigns a to-do or project to Someday
- **THEN** the system clears its start date and Today section and withholds it from Today, Upcoming, and Anytime until the user changes its planning state

#### Scenario: Activate Someday work
- **WHEN** a user moves a Someday item to Anytime or assigns it a start date
- **THEN** the system changes its placement to Anytime and includes it in Anytime or Upcoming according to that start date

#### Scenario: Complete or cancel work
- **WHEN** a user completes or cancels a to-do or project
- **THEN** the system removes it from active planning views and retains it in Logbook according to the history contract

### Requirement: Tagless Structured Semantics
The system SHALL represent workflow meaning through explicit structured concepts and SHALL NOT require generic tags, title parsing, or a generic metadata bag as canonical task data.

#### Scenario: Mark work as not immediately actionable
- **WHEN** a user applies a defined non-actionable state to an open to-do
- **THEN** the system stores `waiting` explicitly, preserves the to-do's planning placement, dates, hierarchy, lifecycle, and order, and can include or exclude it from relevant views without a tag

#### Scenario: Return work to immediate actionability
- **WHEN** a user changes a waiting open to-do back to `actionable`
- **THEN** the system changes only its structured actionability and mutation metadata and leaves its other task dimensions intact

#### Scenario: Preserve waiting work in a planned view
- **WHEN** a waiting to-do belongs to Today, Inbox, Anytime, Someday, Upcoming, a project, or another defined view
- **THEN** the system keeps it in that deliberate placement, presents its waiting state explicitly, and excludes it only when an actionability filter requests actionable work

#### Scenario: Reject actionability changes outside active work
- **WHEN** a caller attempts to change actionability on completed, canceled, or recoverably deleted work
- **THEN** the system rejects the mutation without changing the record or appending history

#### Scenario: Record task origin
- **WHEN** a to-do is created through web, Raycast, MCP, Mail automation, browser capture, a native client, or import
- **THEN** the system stores that immutable entry channel separately from any typed source reference

#### Scenario: Preserve a typed source
- **WHEN** a task is captured from a webpage, Mail message, file, selected text, reading item, template, or import
- **THEN** the system stores the stable source fields and source-specific lifecycle metadata defined for that type without requiring an emoji or text prefix

#### Scenario: Retry an automated capture
- **WHEN** an automated entry channel retries creation with the same idempotency key
- **THEN** the system returns the original task and does not duplicate the source record

#### Scenario: Render an origin indicator
- **WHEN** the interface displays a task whose origin has a configured indicator
- **THEN** the interface derives that presentation from origin metadata rather than parsing the task title

### Requirement: Bulk Task Planning
The system SHALL provide an explicit, accessible selection mode for open tasks and SHALL apply the approved bulk temporal-planning actions to the selected records as one local transaction.

#### Scenario: Select multiple visible tasks
- **WHEN** a user enters task selection in Inbox, Today, Upcoming, Anytime, or Someday and selects one or more visible tasks
- **THEN** the interface reports the selected count, exposes Select All and Clear controls, and makes each row's selected state available to keyboard and assistive-technology users

#### Scenario: Plan selected tasks
- **WHEN** a user applies Move to Inbox, Today, This Evening, Tomorrow, Anytime, or Someday to selected tasks
- **THEN** the system updates every selected task's destination, Today section, start date, mutation metadata, revision, and destination order in one local transaction while preserving the selected task order

#### Scenario: Reject one invalid bulk member
- **WHEN** any selected task is no longer open and present or the requested start date conflicts with one selected task's deadline
- **THEN** the system rejects the bulk planning operation without writing any selected task and leaves selection available for correction or retry

#### Scenario: Keep bulk scope bounded
- **WHEN** the user exits selection, changes task views, or completes a successful bulk plan
- **THEN** the client clears the selection and returns to ordinary single-task editing without adding bulk completion, deletion, or structural hierarchy mutation to this capability

### Requirement: Native Templates
The system SHALL support reusable, revisioned to-do and project template definitions that are separate from active task records.

#### Scenario: Create work from a template
- **WHEN** a user instantiates a to-do or project template revision with an explicit planning anchor
- **THEN** the system atomically creates independent active records, resolves relative planning values, and records template, revision, instantiation, and template-node provenance

#### Scenario: Edit an instantiated task
- **WHEN** a user edits work created from a template
- **THEN** the system does not modify the source template unless the user explicitly chooses a template-editing action

#### Scenario: Keep templates out of active views
- **WHEN** a template definition exists but has not been instantiated
- **THEN** the system excludes the definition from Inbox, Today, Upcoming, Anytime, Someday, and Logbook

#### Scenario: Revise a template
- **WHEN** a user edits a template that already has generated instances
- **THEN** the system creates a new current template revision and leaves every existing instance unchanged

#### Scenario: Retry template instantiation
- **WHEN** a caller retries instantiation with the same idempotency key
- **THEN** the system returns the original generated hierarchy and never exposes a duplicate or partial instance

#### Scenario: Reject a changed template retry
- **WHEN** a caller reuses a template-instantiation idempotency key with a different template, revision, anchor, target area, channel, or actor
- **THEN** the system rejects the request and leaves the original generated hierarchy unchanged

#### Scenario: Capture relative planning from current work
- **WHEN** a user saves a current open to-do or project hierarchy as a template revision with an explicit reference date
- **THEN** the system stores immutable relative start-date and deadline offsets, ordering, actionability, headings, and checklist content without treating the source work as the template definition

#### Scenario: Archive a used template
- **WHEN** a user deletes a template that has generated instances
- **THEN** the system archives the definition, excludes it from new-template selection, and preserves readable provenance for existing work

#### Scenario: Hydrate an owner-safe template response
- **WHEN** an authenticated template RPC omits the owner identifier from its returned definition, revision, or instantiation
- **THEN** the client assigns the already authenticated owner to the parsed result without requiring the server to echo an owner identifier

### Requirement: Orthogonal Task State
The system SHALL model lifecycle, record disposition, planning placement, and structured actionability as separate dimensions with revision-checked transitions and append-only history.

#### Scenario: Complete open work
- **WHEN** a caller completes present open work from the current revision
- **THEN** the system sets the lifecycle to completed, records `completed_at`, removes the work from active views, and appends one completion event

#### Scenario: Cancel open work
- **WHEN** a caller cancels present open work from the current revision
- **THEN** the system sets the lifecycle to canceled, records `canceled_at`, removes the work from active views, and appends one cancellation event

#### Scenario: Reopen terminal work
- **WHEN** a caller reopens completed or canceled work from the current revision
- **THEN** the system returns the lifecycle to open, clears the current terminal timestamp, and retains the prior completion or cancellation event in history

#### Scenario: Retry a lifecycle transition
- **WHEN** a caller repeats a lifecycle mutation with the same client mutation identifier
- **THEN** the system returns the original receipt without appending another history event

#### Scenario: Request the current lifecycle again
- **WHEN** a caller with a new mutation identifier requests a lifecycle value the record already has
- **THEN** the system returns a no-op receipt without appending a duplicate terminal event

#### Scenario: Transition a project with open descendants
- **WHEN** a caller completes or cancels a project that still has open descendants without an explicit descendant policy
- **THEN** the system rejects the transition without changing the project or descendants

#### Scenario: Cascade a project transition explicitly
- **WHEN** a caller invokes a supported cascade transition for a project and its open descendants
- **THEN** the system applies the transition atomically and reports every affected stable identifier

#### Scenario: Complete a parent to-do with checklist state
- **WHEN** a caller completes and later reopens a to-do with checklist items
- **THEN** the system preserves each checklist item's prior completion state

### Requirement: Temporal Planning Semantics
The system SHALL store start dates and deadlines as local calendar dates, derive Today from the owner's IANA planning time zone, and store reminders as unambiguous resolved instants with their original local intent.

#### Scenario: Start date and deadline coexist
- **WHEN** a to-do has both a start date and a later deadline
- **THEN** the system uses the start date to control when the to-do becomes active and retains the deadline as the completion boundary

#### Scenario: Reject an impossible date range
- **WHEN** a caller supplies a deadline earlier than the start date
- **THEN** the system rejects the mutation without partially changing temporal values

#### Scenario: Travel across time zones
- **WHEN** the owner's current or planning time zone changes
- **THEN** date-only start and deadline values remain assigned to the same calendar dates

#### Scenario: Place work in This Evening
- **WHEN** a user places work in This Evening
- **THEN** the system records an evening section value only on work assigned to the owner's current planning date and does not convert it into an independent date or reminder time

#### Scenario: Resolve a reminder
- **WHEN** a caller schedules a reminder with a local date, wall-clock time, and IANA time zone
- **THEN** the system stores that intent and the resulting UTC instant used by every delivery client

#### Scenario: Resolve a nonexistent reminder time
- **WHEN** a requested local reminder time falls in a daylight-saving gap
- **THEN** the system selects the first valid instant after the gap and records the adjustment

#### Scenario: Resolve an ambiguous reminder time
- **WHEN** a requested local reminder time occurs twice during a daylight-saving transition and the caller supplies no preference
- **THEN** the system selects the earlier instant and records that choice

#### Scenario: Display a reminder after travel
- **WHEN** the owner's display time zone changes after a reminder is resolved
- **THEN** the interface converts the stored instant for display without moving the scheduled instant

### Requirement: Recurrence Integrity
The system SHALL keep recurrence definitions separate from generated task occurrences and SHALL assign every logical recurrence event a deterministic, unique identity.

#### Scenario: Generate a recurring occurrence
- **WHEN** a recurrence definition becomes due to produce work
- **THEN** the authoritative server transaction creates no more than one occurrence for that logical recurrence event

#### Scenario: Complete an occurrence
- **WHEN** a user completes one occurrence of after-completion work
- **THEN** the system preserves the recurrence definition and evaluates one next event from the authoritative completion

#### Scenario: Cancel an after-completion occurrence
- **WHEN** a user cancels an occurrence governed by an after-completion rule
- **THEN** the system does not advance that rule from the cancellation

#### Scenario: Retry occurrence generation
- **WHEN** clients or jobs concurrently request generation for the same logical recurrence event
- **THEN** a uniqueness boundary returns the one existing occurrence instead of creating a duplicate

#### Scenario: Evaluate missed calendar events
- **WHEN** a calendar recurrence has one or more missed events
- **THEN** the generator applies the definition's explicit `skip`, `latest`, or `all` policy and defaults to `latest`

#### Scenario: Edit a recurrence definition
- **WHEN** a user changes a recurrence definition after it has generated work
- **THEN** the change affects only future ungenerated occurrences and existing occurrences retain their source revision

#### Scenario: Pause recurrence
- **WHEN** a user pauses or archives a recurrence definition
- **THEN** the system stops future generation without deleting existing occurrences

#### Scenario: Hydrate an owner-safe recurrence response
- **WHEN** an authenticated recurrence RPC omits the owner identifier from its returned definition or revision
- **THEN** the client assigns the already authenticated owner to the parsed result while synchronized recurrence rows continue to validate their stored owner identifier

### Requirement: Stable Manual Ordering
The system SHALL preserve intentional manual ordering across saves, refreshes, offline operation, and synchronization.

#### Scenario: Reorder active work
- **WHEN** a user moves an item within an ordered task view
- **THEN** the system saves the new order without changing unrelated items

#### Scenario: Reorder sections of Today independently
- **WHEN** a user reorders work in Unfinished, Today, or This Evening
- **THEN** the system changes only that item's order within the same visible section and does not move it across planning dates or Today sections

#### Scenario: Reorder active and inactive planning pools independently
- **WHEN** a user reorders work in Anytime or Someday
- **THEN** the system changes only that item's order within its current planning placement and does not activate, defer, schedule, or move unrelated work

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

#### Scenario: Converge web and automation mutations in either winner order
- **WHEN** the web client and an authenticated automation client mutate the same task from one base revision before both mutations settle
- **THEN** whichever revision reaches the authoritative service first remains, the stale path drains or returns a content-free conflict receipt, every client converges to that row, and immutable entry provenance remains unchanged

### Requirement: Actionable Synchronization Diagnostics
The system SHALL expose synchronization state without logging task content, including durable queue depth, last successful synchronization, upload and download activity or errors, and conflict receipts.

#### Scenario: Upload path fails while the client is otherwise active
- **WHEN** the task upload API is unavailable but the application and synchronization stream remain active
- **THEN** the client retains the queued mutation and reports the upload failure separately from its general connection state

### Requirement: Recoverable History
The system SHALL provide append-only history, mutation receipts, inverse-mutation undo, recoverable deletion, versioned export, and verified restore behavior before the module is considered replacement-ready.

#### Scenario: Undo a recent change
- **WHEN** a user invokes undo for a supported recent task mutation
- **THEN** the system restores the prior state and synchronizes the restoration as a new valid mutation

#### Scenario: Reject an unsafe undo
- **WHEN** intervening changes make the requested inverse mutation unsafe
- **THEN** the system rejects undo without overwriting current data and returns a conflict receipt

#### Scenario: Return a mutation receipt
- **WHEN** the system accepts, rejects, or treats a task-domain mutation as a no-op
- **THEN** it returns a content-free receipt with the client mutation identifier, actor, channel, affected stable identifiers, revisions, transition, timestamp, outcome, and applicable code

#### Scenario: Delete a task
- **WHEN** a user deletes a to-do or project through the normal interface
- **THEN** the system moves it to a recoverable deleted state rather than immediately erasing it

#### Scenario: Restore deleted work
- **WHEN** a user restores a recoverably deleted item
- **THEN** the system restores the item and its supported descendants to their prior lifecycle, planning, parent, and order values when those destinations remain valid

#### Scenario: Restore work whose container no longer exists
- **WHEN** a recoverably deleted root cannot return to its prior container
- **THEN** the system restores the hierarchy to Inbox and reports the fallback in the mutation receipt

#### Scenario: Permanently delete work
- **WHEN** a user invokes the separately authorized and confirmed permanent-deletion operation for work already in Trash
- **THEN** the system reports and then erases the selected hierarchy and related owner data without presenting the operation as undoable

#### Scenario: Export task data
- **WHEN** a user requests an export
- **THEN** the system produces a versioned JSON envelope with a manifest, counts, checksums, stable identifiers, active data, templates, recurrence definitions, source metadata, history, and recoverably deleted records without credentials or delivery tokens

#### Scenario: Preview a restore
- **WHEN** a user supplies an export for dry-run restore
- **THEN** the system validates checksums and schema compatibility and reports planned inserts, matches, and conflicts without writing task data

#### Scenario: Merge a restore
- **WHEN** a user restores an export into existing data
- **THEN** the system assigns records to the authenticated owner, matches by stable identifier, remains idempotent on retry, and reports conflicts without overwriting newer records

#### Scenario: Recover after complete source loss
- **WHEN** the source account and its server rows no longer exist and the user merges a verified current backup under another authenticated owner
- **THEN** every portable collection is rebound to that owner atomically, including append-only history and recoverably deleted work, while excluded credentials and delivery diagnostics remain absent

#### Scenario: Replay an exact current backup
- **WHEN** the user retries a current-schema backup after its complete merge already succeeded
- **THEN** every collection is reported as an exact match, no row is rewritten or duplicated, and legacy compatibility conversion does not create a false conflict

#### Scenario: Reject backup tampering
- **WHEN** exported content no longer matches its manifest checksum
- **THEN** preview and merge reject the envelope before any task data is written

#### Scenario: Replace data from a restore
- **WHEN** a user explicitly selects replace restore
- **THEN** the system requires a verified pre-restore backup and separate confirmation before atomically replacing task data

### Requirement: Layered Reminder Delivery
The system SHALL keep the server authoritative for reminder scheduling and logical delivery identity while supporting Web Push, in-app delivery, and later native delivery targets through one idempotent contract.

#### Scenario: Schedule reminder delivery
- **WHEN** a reminder instant is accepted
- **THEN** the server creates one stable logical delivery occurrence and targets each registered delivery endpoint idempotently

#### Scenario: Retry one delivery target
- **WHEN** a provider request is retried for the same occurrence and registered target
- **THEN** the system reuses the target-delivery identifier and does not create another logical delivery

#### Scenario: Open multiple browser tabs
- **WHEN** multiple tabs observe the same due reminder
- **THEN** the tabs share the logical occurrence and do not create duplicate server delivery records

#### Scenario: Deliver on multiple registered devices
- **WHEN** an owner has multiple explicitly registered delivery targets
- **THEN** each target may receive the same logical occurrence once under its own target-delivery identifier

#### Scenario: Delivery capability is unavailable
- **WHEN** notification permission is denied, platform support is missing, or a target expires
- **THEN** the task remains usable and the interface reports degraded reminder capability

#### Scenario: Register Web Push explicitly
- **WHEN** a user invokes the browser-reminder Enable action on a supported secure client and grants notification permission
- **THEN** the client registers one standards-based service-worker subscription, the server stores its provider credentials outside the synchronized target projection, and repeated registration reuses the target identity

#### Scenario: Report delivery outcome
- **WHEN** a notification provider accepts a delivery request
- **THEN** the system records provider acceptance separately from user acknowledgement and does not claim that the user saw the reminder

#### Scenario: Acknowledge an opened notification
- **WHEN** the user opens a Web Push notification for a logical occurrence
- **THEN** the authenticated Tasks route acknowledges that occurrence and later in-app or provider claims do not create another delivery after acknowledgement

### Requirement: Keyboard-First Daily Operation
The system SHALL support efficient keyboard operation for high-frequency capture, navigation, editing, scheduling, movement, completion, and search workflows.

#### Scenario: Navigate without a pointer
- **WHEN** a keyboard user moves through a task view
- **THEN** focus remains visible and predictable across every interactive control

#### Scenario: Complete selected work
- **WHEN** a user invokes the completion command on the focused to-do
- **THEN** the system completes that to-do and moves focus according to the documented next-item behavior

#### Scenario: Invoke a task command safely
- **WHEN** focus is on a task title and no editor, unrelated modal, or composition event owns keyboard input
- **THEN** Enter opens editing, `C` completes the task, `M` opens structural movement, `W` opens temporal planning, Up or Down moves task focus, and Option+Up or Option+Down reorders within the current scope

#### Scenario: Preserve keyboard focus after a task leaves the view
- **WHEN** completion, movement, or recoverable deletion removes the focused task from the current view
- **THEN** focus moves to the task now occupying the same visual position, then the prior task, then task capture or the primary view heading when no task remains

#### Scenario: Navigate with web-safe commands
- **WHEN** a keyboard user invokes the `G` navigation sequence outside an editable control
- **THEN** the documented second key navigates to Inbox, Today, Upcoming, Anytime, Someday, Logbook, Projects, Templates, or Trash without claiming browser tab-number shortcuts

#### Scenario: Open task capture, search, or keyboard help
- **WHEN** a keyboard user presses `N`, `/`, or `?` outside an editable control or unrelated modal
- **THEN** the module respectively focuses task capture, opens unified search and navigation, or opens a visible keyboard-command reference

#### Scenario: Search and filter without unstructured labels
- **WHEN** a user searches present work or filters the result set
- **THEN** the module matches task text and structured source or hierarchy context, filters through explicit planning destination, lifecycle, actionability, and source-kind fields, and does not introduce generic tags

#### Scenario: Open a task across views from search
- **WHEN** a user activates a task search result
- **THEN** the module navigates through a real in-app link to the task's current planning or history view and opens or focuses the stable task record

#### Scenario: Keep structural movement and temporal planning distinct
- **WHEN** a user invokes `M` or `W` on a focused open task
- **THEN** `M` changes only area, project, or heading placement while `W` changes only planning destination, Today section, or start date

#### Scenario: Save or cancel an open editor
- **WHEN** a keyboard user presses Command+Enter or Escape in an open task editor
- **THEN** the module respectively saves valid changes or cancels editing and restores focus to the task title

#### Scenario: Leave browser and text-entry commands intact
- **WHEN** focus is in an input, textarea, select, content-editable surface, or unrelated modal
- **THEN** app-level single-key commands remain inactive, native Tab traversal continues, and the module does not claim Command+1 through Command+9, Command+T, Command+L, Command+R, or Command+W

#### Scenario: Traverse a task and its complete editor
- **WHEN** a keyboard user advances or reverses focus through a task row or expanded task editor
- **THEN** every available interactive control receives visible focus in documented order, unavailable controls are skipped, and save or cancel returns focus to the task title

#### Scenario: Announce task controls and command surfaces
- **WHEN** assistive technology inspects the task surface, an expanded editor, or a command dialog
- **THEN** every interactive control has a nonempty programmatic name, stateful controls expose their current state, and each dialog has a programmatic title without a dangling description reference

#### Scenario: Respect reduced-motion preference
- **WHEN** the operating system requests reduced motion while the Tasks route is mounted
- **THEN** task-page and portal animations, transitions, delays, and smooth scrolling are reduced without changing the motion policy of unrelated BathOS routes

#### Scenario: Open global quick entry on Mac
- **WHEN** the user invokes the configured Raycast task-entry hotkey
- **THEN** Raycast presents required title and optional notes inputs without requiring the BathOS browser tab to be focused

#### Scenario: Capture from Raycast
- **WHEN** the user submits a nonempty title through Raycast quick entry
- **THEN** the authenticated task service creates exactly one Inbox to-do with `raycast` entry provenance and returns an accepted or already-applied receipt

#### Scenario: Authorize Raycast safely
- **WHEN** the Raycast command has no usable delegated credential
- **THEN** it performs browser-based Authorization Code with S256 PKCE and retains the rotating refresh credential in the macOS login Keychain without storing a BathOS password, browser session, service-role credential, or client secret

#### Scenario: Retry a capture safely
- **WHEN** delivery of a submitted Raycast capture is retried after an ambiguous response
- **THEN** the command reuses that capture's creation UUID and the service does not create a duplicate to-do

#### Scenario: Capture the active browser page
- **WHEN** the user invokes page capture while Safari, Safari Technology Preview, Google Chrome, or Google Chrome Canary has a normal HTTP(S) active tab
- **THEN** the system creates one Inbox to-do with a cleaned deterministic title, `browser_capture` entry provenance, and a typed `webpage` source containing the exact accepted URL and optional browser title

#### Scenario: Reject unavailable browser context
- **WHEN** the frontmost application is unsupported, has no browser window, or exposes an invalid, blank, non-HTTP(S), or browser-owned URL
- **THEN** page capture explains that no supported page is available and does not submit a task mutation

#### Scenario: Present browser provenance structurally
- **WHEN** page capture creates a to-do
- **THEN** the title contains no required emoji or textual source prefix and the URL remains available through structured source fields and provisional notes

#### Scenario: Retry browser capture safely
- **WHEN** a page-capture response is ambiguous and the pending request is retried
- **THEN** the complete original title, notes, channel, typed source, and creation UUID are reused so the source fields are preserved and no duplicate to-do is created

#### Scenario: Capture one selected Finder item
- **WHEN** the user invokes Finder capture with exactly one file or folder selected
- **THEN** the system creates one Inbox to-do with `raycast` entry provenance, the selected item's name, and a typed `file` source whose local `file://` reference is treated as originating-Mac context rather than a portable cross-device identifier

#### Scenario: Reject an ambiguous Finder selection
- **WHEN** Finder has no selected item or more than one selected item
- **THEN** Finder capture explains that exactly one item is required and does not submit a task mutation

#### Scenario: Capture the current selected text
- **WHEN** the user invokes selected-text capture while the frontmost app exposes a nonempty copyable text selection
- **THEN** the command actively copies that selection, creates one Inbox to-do with `raycast` entry provenance and typed `selected_text` source provenance, uses the first nonempty line as the title, and preserves the captured excerpt in notes

#### Scenario: Reject stale clipboard text
- **WHEN** the frontmost app does not produce a new nonempty clipboard value after selected-text capture sends Cmd-C
- **THEN** the command restores the prior plain-text clipboard value, explains that current text must be selected, and does not submit a task mutation

#### Scenario: Capture a reading item
- **WHEN** the user invokes reading-list capture on a supported normal browser page
- **THEN** the command uses the verified AI webpage-title workflow with its deterministic fallback and creates one unassigned daytime Today to-do with `browser_capture` entry provenance, a typed `reading_item` source, and the source URL in notes

#### Scenario: Present reading provenance structurally
- **WHEN** reading-list capture creates a to-do
- **THEN** the title does not retain the legacy glasses prefix because reading provenance is authoritative in the typed source

#### Scenario: Preserve Mail source identity and lifecycle
- **WHEN** a future specialized Mail capture atomically creates a task and its Mail source record
- **THEN** the owner-scoped source record preserves the task relationship, account and mailbox identifiers, durable message identifier, `message://` deep link, retirement destination, explicit retirement lifecycle, revision, and mutation identifier without storing Mail content

#### Scenario: Create a processed Mail task
- **WHEN** authenticated Mail capture supplies AI-processed title and notes, complete source identity, retirement destination, and optional verified work-area assignment
- **THEN** the specialized service creates one unassigned or area-assigned daytime Today task and retained source record in a single transaction with no generic fallback write

#### Scenario: Retire a Mail source only after verified movement
- **WHEN** the integration begins retirement and then attempts the external Mail move
- **THEN** the source first enters `retirement_pending`, changes to `retired` only after verified success, or changes to `retirement_failed` with a bounded diagnostic that permits an explicit retry

#### Scenario: Audit Mail source retirement
- **WHEN** an accepted Mail source lifecycle mutation changes state
- **THEN** the system appends one immutable owner-scoped event with the request UUID, transition, base and result revisions, time, and optional failure code while rejecting direct authenticated state changes

#### Scenario: Reject an incomplete Mail source pair
- **WHEN** a Mail task lacks its one-to-one source record, a non-Mail task owns one, or the task and source disagree about message identity or deep link
- **THEN** the database rejects the transaction without leaving a partial task or source record

#### Scenario: Export and restore Mail source state
- **WHEN** the user exports and restores task data containing a Mail-sourced task
- **THEN** the versioned portable envelope preserves the owner-safe Mail source record and its complete append-only retirement event chain, validates that the current lifecycle and revision match the audit tip, rebinds restored ownership to the authenticated user, and excludes owner identifiers and Mail content

#### Scenario: Gate Mail capture on a complete integration contract
- **WHEN** parallel-use approval has not passed verification
- **THEN** Mail capture remains disabled and Inbox Manager does not dual-write to BathOS

### Requirement: Large-Library Responsiveness
The system SHALL retain bounded task-view and search latency as active and historical task data grows beyond the owner's current library.

#### Scenario: Derive task views at synthetic scale
- **WHEN** the performance harness derives Inbox, Today, Upcoming, Anytime, Someday, Logbook, or Trash from 10,000 mixed synthetic records
- **THEN** each derivation remains below 100 ms p95 and returns the complete correctly ordered view

#### Scenario: Search a large task library
- **WHEN** the search surface indexes and filters 10,000 synthetic tasks across text, hierarchy, placement, lifecycle, actionability, and source kind
- **THEN** reusable index construction remains below 100 ms p95, each text or structured filter remains below 50 ms p95, and result presentation remains capped without misreporting the total match count

#### Scenario: Render a task view larger than the current library
- **WHEN** the development performance harness renders 1,000 interactive task rows and opens search over 10,000 records
- **THEN** the initial view render remains below 2,000 ms, search opens below 1,000 ms, and the module retains its complete keyboard and assistive-technology contract

### Requirement: Parallel Use with Things
The system SHALL support indefinite parallel use without requiring the user to migrate, delete, or modify the existing Things library.

#### Scenario: Begin using the BathOS module
- **WHEN** the user creates task data in BathOS during development
- **THEN** the system does not write to or delete data from Things

#### Scenario: Perform discovery inventory
- **WHEN** an authorized discovery process reads Things through AppleScript
- **THEN** the process remains read-only, bounded, and excludes private task content from the public repository

#### Scenario: Exercise sustained automated parallel use
- **WHEN** two persistent local task clients plus the Raycast-aware creation and MCP mutation services run repeated retry, conflict, completion, and restart cycles for at least ten minutes
- **THEN** upload queues drain, accepted revisions remain authoritative, exact retries do not duplicate work, every replica converges, and task, history, and conflict-receipt counts remain exact

#### Scenario: Preserve the migration decision after an automated pass
- **WHEN** the sustained automated gate passes but lived parallel use and production-device boundaries remain unresolved
- **THEN** Things remains authoritative, Inbox Manager dual-writing remains disabled, and the system does not treat the automated result as migration approval

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

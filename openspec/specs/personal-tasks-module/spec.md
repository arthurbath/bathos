# Personal Tasks Module Specification

## Purpose

Define the private, tagless BathOS Tasks domain, its production synchronization and reminder boundaries, and the interaction, recovery, automation, and parallel-use contracts required for dependable personal task management.
## Requirements
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

#### Scenario: Join an existing multi-tab synchronization session
- **WHEN** a Tasks tab opens after the shared multi-tab database has already reported its connection state
- **THEN** the tab initializes from the current PowerSync status before waiting for later events and does not remain in a synthetic Connecting state

#### Scenario: Validate production synchronization before personal use
- **WHEN** the production service, publication, stream rules, authentication, and client endpoint are configured
- **THEN** a synthetic owner proves cross-client download, queued upload, conflict handling, restart recovery, owner isolation, and cleanup before the user stores personal task content

#### Scenario: Report incomplete synthetic cleanup
- **WHEN** production-topology validation exits after a failed assertion or another interrupted test path
- **THEN** it attempts every local-database, session, synthetic-owner, and temporary-artifact cleanup step and reports every cleanup failure as uncertain residue

#### Scenario: Evolve the synchronized task projection
- **WHEN** a nonlocal task collection is added to or removed from the client schema
- **THEN** the production and disposable streams, production and disposable publications, replication-role grants, database preflight, replica identity, RLS, and regression test change together as one exact owner-scoped set

#### Scenario: Exclude server-only task secrets
- **WHEN** the synchronized task projection is configured
- **THEN** it excludes Web Push subscription material, Mail source lifecycle records, private operational context, and every non-Tasks module table

#### Scenario: Bound non-Tasks database access
- **WHEN** the dedicated synchronization role connects for logical replication
- **THEN** its publication and application-data access contain exactly the approved synchronized Tasks tables, while deployment verification rejects every additional schema or relation except a documented, owner-controlled pg_net surface that hosted Supabase grants to all roles and the project database owner cannot revoke

#### Scenario: Operate without an approved remote topology
- **WHEN** no production PowerSync endpoint is configured
- **THEN** the module identifies itself as local-only, preserves that installation's durable task data, and does not imply cross-device or MCP convergence

#### Scenario: Preserve the promotion boundary
- **WHEN** a free or single-instance topology is used for parallel evaluation
- **THEN** the system does not treat that topology as authoritative until uptime, monitoring, backup, upgrade, outage, and recovery behavior pass a later explicit review

### Requirement: Independent Task Day Horizon
The system SHALL store an optional to-do or project day horizon independently for active work and SHALL require one of `inbox`, `now`, `next`, or `later` while a future start date exists.

#### Scenario: Default a newly assigned start date to Next
- **WHEN** a user assigns a start date without explicitly selecting a day horizon
- **THEN** the system stores `next` for that item

#### Scenario: Retain a future day horizon
- **WHEN** a user assigns a future start date and Inbox, Now, Next, or Later to an Anytime to-do or project
- **THEN** the system keeps the item in Upcoming until its owner-local start date and retains the selected day horizon unchanged

#### Scenario: Keep undated work outside Today
- **WHEN** an open present Anytime item has no start date and no day horizon
- **THEN** the system includes it in Anytime while withholding it from Today

#### Scenario: Keep active undated work in Today
- **WHEN** an open present Anytime item has no start date and an Inbox, Now, Next, or Later horizon
- **THEN** the system includes it in Anytime and the selected Today section

#### Scenario: Preserve horizon through structured generation and portability
- **WHEN** templates, recurrence, MCP, export, merge, replacement restore, or synchronization carry an Anytime item's planning state
- **THEN** the system requires a horizon for a future date, permits a horizon on active undated work, and normalizes reached dates to null while retaining or defaulting the active horizon

### Requirement: Core Task Organization
The system SHALL organize active work through Anytime, Someday, areas, projects, to-dos, and checklist items without headings, a separate Inbox destination, generic tags, multiple membership, or required parent containers.

#### Scenario: Organize work in a project
- **WHEN** a user places a to-do under a project
- **THEN** the to-do belongs to exactly that one project and retains its stable identity and planning membership

#### Scenario: Organize ongoing responsibility
- **WHEN** a user places a project or loose to-do in an area
- **THEN** the item belongs to exactly that one area and the system includes it in that area's active work

#### Scenario: Leave work unattached
- **WHEN** a to-do has no project or area, or a project has no area
- **THEN** the system preserves that valid unattached state without inventing a container

#### Scenario: Review active work in an area
- **WHEN** a user opens an area from Projects
- **THEN** the interface presents that owner's present open loose to-dos and projects, preserves real links to project details and each to-do's current planning view, and excludes Done or unrelated work

#### Scenario: Keep project membership canonical
- **WHEN** a to-do belongs to a project whose area changes
- **THEN** the to-do remains in its one project, derives its area from that project, and does not retain a competing direct area assignment

#### Scenario: Keep project identity legible beside lifecycle controls
- **WHEN** a project with a long title is opened at 390 CSS pixels wide
- **THEN** the complete project title occupies its own mobile row without overlapping or collapsing behind Complete, Cancel, Reopen, or Delete actions, and the actions remain fully operable

#### Scenario: Move a to-do between containers
- **WHEN** a user moves a to-do to one area, one project, or no container
- **THEN** the system clears incompatible parent references, preserves the to-do's stable identity and planning state, and assigns an order within the new hierarchy scope

#### Scenario: Maintain a checklist
- **WHEN** a user adds, edits, reorders, completes, reopens, or recoverably removes a checklist item
- **THEN** the checklist item remains owned by exactly one to-do and its completion state remains independent from the parent to-do's lifecycle

#### Scenario: Order hierarchy independently from planning views
- **WHEN** a user reorders an area, project, project to-do, loose area to-do, unattached to-do, or checklist item
- **THEN** the system changes only the selected item's hierarchy order and does not change its order or membership in Today, Anytime, Someday, Upcoming, or Done

#### Scenario: Preserve to-dos while removing headings
- **WHEN** the system migrates a to-do previously assigned to a heading
- **THEN** it retains the to-do in the same project with the same stable identity, task content, planning state, hierarchy order, checklist, history, and source metadata while removing the heading reference

#### Scenario: Capture new work for triage
- **WHEN** a user or supported integration creates a to-do without an explicit planning placement
- **THEN** the system creates one open present Anytime to-do with no start date and the Today Next horizon

### Requirement: Readable Markdown Task Notes
The system SHALL retain task notes as plain text while presenting one complete, directly editable, live-styled Markdown source surface in an expanded to-do without separate editing and preview modes.

#### Scenario: Edit complete live-styled source
- **WHEN** a user opens a to-do and edits its notes
- **THEN** the interface keeps the complete plain-text source directly editable without an internal height limit, preserves every Markdown delimiter visibly, and updates recognized Markdown styling as the source changes without requiring an alternate mode

#### Scenario: Limit live Markdown recognition
- **WHEN** notes contain supported Markdown syntax
- **THEN** the editor recognizes headings introduced by one or more hashmarks and a space, single-asterisk italic, double-asterisk bold, asterisk-plus-space bullets, Markdown links, and single-backtick inline code while treating other Markdown constructs as ordinary text

#### Scenario: Style Markdown indicators
- **WHEN** the editor recognizes a heading, italic, bold, bullet, or Markdown link
- **THEN** the original hashmark-and-space, asterisk, bracket, and parenthesis indicators remain visible in a fixed-width font while the complete recognized construct receives its heading, italic, bold, bullet, or link presentation

#### Scenario: Style inline code completely
- **WHEN** the editor recognizes text enclosed by single backticks on one line
- **THEN** the complete string including both backticks uses a fixed-width font and a light semantic background

#### Scenario: Continue an asterisk bullet
- **WHEN** a user presses Enter without Shift while editing a line that begins with `* `
- **THEN** the editor inserts a new line beginning with `* ` and wraps each bullet with a two-fixed-width-character hanging indent

#### Scenario: Follow a note link
- **WHEN** notes contain a Markdown link, bare HTTP(S) URL, or bare alphanumeric `scheme://` destination such as `message://`
- **THEN** the live editor exposes the safe destination with a pointer cursor and no hover underline, opens HTTP(S) in a new browser context, dispatches `message://` to Mail, and keeps known executable or content-injection schemes inert

#### Scenario: Preserve editing mechanics while styling
- **WHEN** the editor retokenizes changed source
- **THEN** it preserves the user's caret or selection, defers decoration during composition, accepts pasted content as plain text, yields documented undo and redo commands to Tasks, and autosaves the identical source to the same notes field

#### Scenario: Start empty notes directly
- **WHEN** an expanded to-do has empty notes
- **THEN** the same live editor presents its placeholder without requiring a separate preview step

### Requirement: Legible Task Lifecycle Feedback
The system SHALL distinguish task completion from bulk selection by shape and SHALL provide brief recoverable visual feedback before terminal work leaves an active list.

#### Scenario: Distinguish completion from selection
- **WHEN** an open task row renders outside selection mode
- **THEN** its completion control is square, while selection mode uses circular selected and unselected controls with distinct accessible names

#### Scenario: Complete a task with motion
- **WHEN** a user completes or cancels an active to-do and reduced motion is not requested
- **THEN** the row quickly fades and collapses before leaving the list, accepts no duplicate terminal action, and restores itself if the mutation fails

#### Scenario: Respect reduced motion during completion
- **WHEN** a user completes or cancels a to-do while reduced motion is requested
- **THEN** the interface skips the decorative delay without changing mutation, error recovery, or focus behavior

### Requirement: Date-Based Planning Views
The system SHALL derive Today, Upcoming, Anytime, Someday, and Done from task state, owner-local start dates, deadlines, independent day horizons, and terminal timestamps.

#### Scenario: Defer work to a future date
- **WHEN** a user assigns a future start date to a to-do or project
- **THEN** the system includes the item in Upcoming, withholds it from Today and Anytime until its owner-local start date arrives, and stores its selected horizon or Next by default

#### Scenario: Store an uncommitted possibility
- **WHEN** a user assigns a to-do or project to Someday
- **THEN** the system clears its start date, day horizon, and reminder and withholds it from Today, Upcoming, and Anytime

#### Scenario: Activate Someday work
- **WHEN** a user moves a Someday item to Anytime without a start date
- **THEN** the system changes its destination to Anytime, includes it in Anytime, and retains a null day horizon

#### Scenario: Schedule Someday work
- **WHEN** a user assigns a start date and optional day horizon to Someday work
- **THEN** the system changes its destination to Anytime, includes it in Upcoming or available views according to that date, and stores the chosen horizon or Next by default

#### Scenario: Mark available Anytime work for Today
- **WHEN** a user places available Anytime work in Inbox, Now, Next, or Later
- **THEN** the system keeps a null start date, stores the selected horizon, keeps the same stable item in Anytime, and includes it in the selected Today section

#### Scenario: Review the Today projection
- **WHEN** a user opens Today
- **THEN** the system shows eligible open present Anytime work with no future start date and a day horizon, then groups it in Inbox, Now, Next, and Later order without rendering an empty horizon heading

#### Scenario: Review the Anytime pool
- **WHEN** a user opens Anytime
- **THEN** the system shows every open present Anytime item without a future start date and marks Inbox, Now, Next, or Later for active work that also appears in Today

#### Scenario: Select the Upcoming controlling date
- **WHEN** an open present Anytime item has a future start date
- **THEN** Upcoming uses that start date for membership, ordering, and grouping even when its deadline is earlier or later

#### Scenario: Fall back to a future deadline
- **WHEN** an open present Anytime item has no future start date and has a future deadline
- **THEN** Upcoming includes and groups the item by that deadline while the undated item remains available in Anytime with no day horizon

#### Scenario: Group the next seven days individually
- **WHEN** an Upcoming controlling date falls from tomorrow through the seventh owner-local date after today
- **THEN** the interface groups the item under that individual calendar date in chronological order

#### Scenario: Group later work by month
- **WHEN** an Upcoming controlling date is beyond the next seven dates and no later than the same owner-local calendar date 12 months from today
- **THEN** the interface groups the item under its month and year in chronological order

#### Scenario: Group distant work by year
- **WHEN** an Upcoming controlling date is later than the same owner-local calendar date 12 months from today
- **THEN** the interface groups the item under its calendar year in chronological order

#### Scenario: Preserve a future day horizon
- **WHEN** a user opens Upcoming for an item with a future start date
- **THEN** the interface preserves and exposes its Inbox, Now, Next, or Later horizon without showing the item in Today early

#### Scenario: Remove work from Today
- **WHEN** a user removes Today placement from a to-do
- **THEN** the system clears its day horizon, removes the to-do from Today, and keeps it undated in Anytime without changing its identity or container

#### Scenario: Activate deferred work
- **WHEN** an Anytime item reaches its owner-local start date
- **THEN** an idempotent activation clears its start date, retains its selected horizon, and includes it in Anytime and Today

#### Scenario: Complete, cancel, or delete work
- **WHEN** a user completes, cancels, or deletes a to-do or supported hierarchy root
- **THEN** the system removes it from active planning views and includes it in Done until recovery or automatic purge

### Requirement: Tagless Structured Semantics
The system SHALL represent workflow meaning through explicit structured concepts, including exactly three actionability states, and SHALL NOT require generic tags, title parsing, or a generic metadata bag as canonical task data.

#### Scenario: Default work to actionable
- **WHEN** a caller creates a to-do without an explicit actionability value
- **THEN** the system stores `actionable`

#### Scenario: Wait for another party or signal
- **WHEN** a user marks an open to-do as Waiting
- **THEN** the system stores `waiting` explicitly and communicates that another party or outside event is expected to unblock the work

#### Scenario: Recheck availability without an expected signal
- **WHEN** a user marks an open to-do as Rechecking
- **THEN** the system stores `rechecking` explicitly and communicates that the owner must deliberately test availability again because no outside notification or contact is expected

#### Scenario: Return work to immediate actionability
- **WHEN** a user changes waiting or rechecking open work back to `actionable`
- **THEN** the system changes only its structured actionability and mutation metadata and leaves its other task dimensions intact

#### Scenario: Preserve non-actionable work in a planned view
- **WHEN** a waiting or rechecking to-do belongs to Today, Anytime, Someday, Upcoming, a project, or another defined view
- **THEN** the system keeps it in that deliberate placement, presents its exact actionability state, and excludes it only when an actionability filter requests actionable work

#### Scenario: Reject actionability changes outside active work
- **WHEN** a caller attempts to change actionability on completed, canceled, or recoverably deleted work
- **THEN** the system rejects the mutation without changing the record or appending history

#### Scenario: Record task origin
- **WHEN** a to-do is created through web, Raycast, MCP, Mail automation, browser capture, a native client, or import
- **THEN** the system stores that immutable entry channel separately from any typed source reference

#### Scenario: Preserve a typed source
- **WHEN** a task is captured from a webpage, Mail message, file, reading item, template, or import
- **THEN** the system stores the stable source fields and source-specific lifecycle metadata defined for that type without requiring an emoji or text prefix

#### Scenario: Edit a Primary Link independently
- **WHEN** a user adds, changes, or clears a to-do's Primary Link
- **THEN** the system changes only the optional shortcut and task mutation history without changing typed source identity or source-specific lifecycle records

#### Scenario: Initialize a Mail Primary Link
- **WHEN** verified Mail capture creates a to-do and its audited Mail source
- **THEN** the system also initializes the editable Primary Link from the verified `message://` deep link without coupling later edits to the Mail source

#### Scenario: Activate a Primary Link
- **WHEN** a to-do has a nonblank Primary Link
- **THEN** `message://` uses a Mail icon and operating-system dispatch, HTTP(S) uses a Link icon and new browser context, and another value uses a Link icon and an HTTPS destination formed by prepending `https://`

#### Scenario: Reopen a structured task source
- **WHEN** the interface displays present active or terminal work whose typed source contains a supported HTTP(S), Mail-message, or originating-Mac file reference
- **THEN** it exposes a named real link derived from the structured source fields, opens web sources in a separate browser tab, hands platform deep links to their originating application, and never parses the task title or notes to find the source

#### Scenario: Present provenance without an actionable source link
- **WHEN** a task has typed source provenance but its source reference is absent, malformed, or uses a protocol outside that source type's supported contract
- **THEN** the interface retains a visible named origin indicator without exposing the reference as an actionable link

#### Scenario: Retry an automated capture
- **WHEN** an automated entry channel retries creation with the same idempotency key
- **THEN** the system returns the original task and does not duplicate the source record

#### Scenario: Render an origin indicator
- **WHEN** the interface displays a task whose origin has a configured indicator
- **THEN** the interface derives that presentation from origin metadata rather than parsing the task title

### Requirement: Bulk Task Planning
The system SHALL provide an accessible task-row selection mode for open tasks, SHALL treat selection as a temporary context bounded by to-do rows and selection-owned surfaces, SHALL expose its controls as a fixed bottom overlay that does not move list content, and SHALL apply supported planning actions to selected records.

#### Scenario: Enter selection with the platform modifier
- **WHEN** a user Command-clicks a visible task on Mac or Control-clicks a visible task on Windows while selection is inactive
- **THEN** the interface enters selection, makes that task the stable range anchor, selects it, reports the selected count, and does not open its editor

#### Scenario: Select a contiguous anchored range
- **WHEN** a user Shift-clicks a visible task after establishing a selection anchor
- **THEN** the interface replaces the prior range with the contiguous visible range between the original anchor and the clicked task without moving the anchor

#### Scenario: Replace an anchored range repeatedly
- **WHEN** a user Shift-clicks a different visible task while selection remains active
- **THEN** the interface replaces the previous range with the new contiguous range from the original anchor

#### Scenario: Toggle selection after entry
- **WHEN** selection is active and a user ordinarily clicks, Command-clicks on Mac, or Control-clicks on Windows on a visible task
- **THEN** the interface toggles that task's selected state without opening its editor

#### Scenario: Preserve ordinary task expansion
- **WHEN** selection is inactive and a user ordinarily clicks a task
- **THEN** the interface opens or closes that task's editor exactly as before

#### Scenario: Operate selection accessibly
- **WHEN** one or more visible tasks are selected in Today, Upcoming, Anytime, or Someday
- **THEN** the fixed bottom selection overlay reports the selected count, exposes Select All and Select None, and communicates each selected state to keyboard and assistive-technology users without shifting list content or requiring a persistent header selection button

#### Scenario: Select every visible to-do by keyboard
- **WHEN** focus is not owned by an editable control and a user presses Command+A on Mac or Control+A on Windows in Today, Upcoming, Anytime, or Someday
- **THEN** the interface suppresses the matching browser command, enters selection when necessary, and selects every to-do in the active view without selecting projects or other non-to-do content

#### Scenario: Preserve native text selection
- **WHEN** an editable input, textarea, select, or contenteditable region owns Command+A on Mac or Control+A on Windows
- **THEN** the interface leaves the gesture available to that editable control and does not change bulk selection

#### Scenario: Dismiss selection outside a to-do
- **WHEN** bulk selection is active and the user presses the pointer outside every to-do row and outside the controls that operate the active selection
- **THEN** the interface clears the selection and range anchor and returns to ordinary task interaction

#### Scenario: Retain selection for owned interactions
- **WHEN** bulk selection is active and the user interacts with a title or other control inside a to-do row, the bulk toolbar, or its planning, calendar, organization, or reminder surface
- **THEN** the interface leaves selection active until the owned interaction applies its selection or planning behavior

#### Scenario: Preserve access to the final task
- **WHEN** the fixed selection overlay is visible above the list
- **THEN** the list retains enough bottom scroll space for its final task and controls to move fully above the overlay

#### Scenario: Exit selection directly
- **WHEN** a user presses Escape, activates Done, changes views, or clicks outside a to-do and outside a selection-owned surface
- **THEN** the client clears selection and its stable range anchor and returns to ordinary editing

#### Scenario: Plan selected tasks
- **WHEN** a user applies Today Inbox, Today Now, Today Next, Today Later, Remove from Today, Tomorrow, Anytime, or Someday to selected tasks
- **THEN** the system updates every selected task's destination, start date, selected day horizon, dependent reminder, mutation metadata, revision, and relevant order in one local transaction while preserving selected order

#### Scenario: Apply a focused bulk value
- **WHEN** a selected-task keyboard command requires a start date, due date, organization, or reminder time
- **THEN** the interface opens a centered selection-owned surface, moves focus to its primary date or selection control, and applies the chosen value to every eligible selected task

#### Scenario: Preserve a bulk horizon while scheduling
- **WHEN** a user applies a future date to selected tasks with an Inbox, Now, Next, or Later horizon
- **THEN** the system retains the requested horizon for every valid selected task while the tasks remain in Upcoming

#### Scenario: Allow deliberately overdue bulk work
- **WHEN** a requested start date is later than one or more selected deadlines
- **THEN** the system retains those deadlines and accepts the schedule when every selected record is otherwise valid

#### Scenario: Reject one invalid bulk member
- **WHEN** any selected task is no longer open and present
- **THEN** the system rejects the operation without writing any selected task and leaves selection available for correction or retry

#### Scenario: Keep bulk scope bounded
- **WHEN** the user exits selection, changes views, or completes a successful bulk plan
- **THEN** the client clears selection and its range anchor and returns to ordinary editing without adding bulk completion, deletion, or hierarchy mutation

### Requirement: Native Templates
The system SHALL support reusable, revisioned to-do and project template definitions that are separate from active task records and contain no heading layer.

#### Scenario: Create work from a template
- **WHEN** a user instantiates a to-do or project template revision with an explicit planning anchor
- **THEN** the system atomically creates independent active areas, projects, to-dos, and checklist items, resolves relative planning values, and records template, revision, instantiation, and template-node provenance

#### Scenario: Edit an instantiated task
- **WHEN** a user edits work created from a template
- **THEN** the system does not modify the source template unless the user explicitly chooses a template-editing action

#### Scenario: Keep templates out of active views
- **WHEN** a template definition exists but has not been instantiated
- **THEN** the system excludes the definition from Today, Upcoming, Anytime, Someday, and Done

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
- **THEN** the system stores immutable relative start-date and deadline offsets, independent day horizons, ordering, actionability, and checklist content without treating the source work as the template definition

#### Scenario: Normalize a legacy heading template
- **WHEN** the system instantiates a legacy project-template revision containing heading nodes
- **THEN** it preserves each descendant to-do directly beneath the project in deterministic order and creates no heading record or reference

#### Scenario: Capture a template during a concurrent edit
- **WHEN** a source to-do or project hierarchy changes while template capture is reading it
- **THEN** the stored source revision and complete hierarchy snapshot come from one database statement snapshot rather than mixing source state from different moments

#### Scenario: Archive a used template
- **WHEN** a user deletes a template that has generated instances
- **THEN** the system archives the definition, excludes it from new-template selection, and preserves readable provenance for existing work

#### Scenario: Hydrate an owner-safe template response
- **WHEN** an authenticated template RPC omits the owner identifier from its returned definition, revision, or instantiation
- **THEN** the client assigns the already authenticated owner to the parsed result without requiring the server to echo an owner identifier

### Requirement: Orthogonal Task State
The system SHALL model lifecycle, record disposition, planning destination, Today membership, and structured actionability as separate dimensions with revision-checked transitions and append-only history.

#### Scenario: Complete open work
- **WHEN** a caller completes present open work from the current revision
- **THEN** the system sets lifecycle to completed, records `completed_at`, removes the work from active views, includes it in Done, and appends one completion event

#### Scenario: Cancel open work
- **WHEN** a caller cancels present open work from the current revision
- **THEN** the system sets lifecycle to canceled, records `canceled_at`, removes the work from active views, includes it in Done, and appends one cancellation event

#### Scenario: Cancel an active to-do from the web interface
- **WHEN** a user invokes the visible Cancel action for an active to-do
- **THEN** the web client submits the ordinary revision-checked cancellation transition, removes the to-do from the active view, and makes the canceled record available in Done rather than deleting it

#### Scenario: Reopen terminal work
- **WHEN** a caller reopens completed or canceled work from Done during retention
- **THEN** the system returns lifecycle to open, clears the current terminal timestamp, restores valid Anytime placement with no Today membership when needed, and retains prior history

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

#### Scenario: Delete work
- **WHEN** a caller deletes present work from the current revision
- **THEN** the system records recoverable deletion, includes the root in Done, and preserves the hierarchy operation receipt

#### Scenario: Restore deleted work
- **WHEN** a caller restores deleted work from Done during retention
- **THEN** the system restores valid prior hierarchy and active state, falling back to Anytime with no Today membership when the prior placement is no longer valid

### Requirement: Temporal Planning Semantics
The system SHALL store Start Date as a future-only deferral calendar fact, store Deadline independently, retain day horizons for active Today work, derive activation and Today from the owner's IANA planning time zone, and store reminder times as unambiguous instants resolved on the future start date.

#### Scenario: Start date and deadline coexist in either order
- **WHEN** a to-do has both a start date and a deadline
- **THEN** the system requires the start date to be future, uses it to control deferral, retains the deadline as an informational completion boundary, and accepts either ordering between those two dates

#### Scenario: Continue work after its deadline
- **WHEN** a caller assigns a start date later than the retained deadline
- **THEN** the system accepts the mutation, preserves the overdue deadline, and keeps the item available according to the new start date

#### Scenario: Travel across time zones
- **WHEN** the owner's current or planning time zone changes
- **THEN** date-only start and deadline values remain assigned to the same calendar dates and Today eligibility follows the owner-local planning date

#### Scenario: Reject a reached Start Date
- **WHEN** a user or automation attempts to assign today or an earlier calendar date as Start Date
- **THEN** the system rejects the value without changing the task because Start Date represents only future deferral

#### Scenario: Activate a reached Start Date
- **WHEN** time advances to a stored Start Date in the owner's planning time zone
- **THEN** local and server activation converge on a null start date, retained day horizon, one accepted revision transition, and defensive Today visibility while synchronization catches up

#### Scenario: Place work in a day horizon
- **WHEN** a user selects Inbox, Now, Next, or Later for Anytime work
- **THEN** the system records the active horizon without inventing a start date or reminder time

#### Scenario: Edit start date and dependent controls
- **WHEN** a user opens a to-do's temporal planning controls
- **THEN** the interface always presents Start Date, presents Day Horizon for active Today or deferred work, and presents Reminder Time only when Start Date contains a future value, with complete keyboard operation

#### Scenario: Resolve a reminder
- **WHEN** a caller schedules a reminder with a wall-clock time and IANA time zone for an item with a start date
- **THEN** the system stores that time intent and the resulting UTC instant on the item's future start date for every delivery client

#### Scenario: Resolve a nonexistent reminder time
- **WHEN** a requested local reminder time falls in a daylight-saving gap on the item's start date
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

#### Scenario: Continue calendar evaluation from its durable cursor
- **WHEN** a calendar recurrence has already been evaluated through an earlier date and a new request evaluates it farther forward
- **THEN** the server derives the first unevaluated and latest due logical steps directly, bounds catch-up work independently from the recurrence age, and does not rescan from the original start date

#### Scenario: Evaluate missed calendar events
- **WHEN** a calendar recurrence has one or more missed events
- **THEN** the generator applies the definition's explicit `skip`, `latest`, or `all` policy and defaults to `latest`

#### Scenario: Edit a recurrence definition
- **WHEN** a user changes a recurrence definition after it has generated work
- **THEN** the change affects only future ungenerated occurrences and existing occurrences retain their source revision

#### Scenario: Pause recurrence
- **WHEN** a user pauses or archives a recurrence definition
- **THEN** the system stops future generation without deleting existing occurrences

#### Scenario: Report a failed catch-up independently from an accepted definition change
- **WHEN** a recurrence definition is created, revised, or resumed successfully but its immediate occurrence evaluation fails
- **THEN** the system retains the accepted definition change, reports catch-up as a separate content-free failure, avoids an automatic retry loop for the same planning date, and exposes an explicit retry action

#### Scenario: Distinguish unavailable recurrence data from an empty list
- **WHEN** the recurrence projection is loading or fails to load
- **THEN** the web interface presents the corresponding loading or failure state, withholds the empty-list claim, and disables recurrence mutation until the projection is trustworthy

#### Scenario: Hydrate an owner-safe recurrence response
- **WHEN** an authenticated recurrence RPC omits the owner identifier from its returned definition or revision
- **THEN** the client assigns the already authenticated owner to the parsed result while synchronized recurrence rows continue to validate their stored owner identifier

### Requirement: Stable Manual Ordering
The system SHALL preserve intentional manual ordering across direct drag, keyboard or menu moves, same-view Today horizon changes, saves, refreshes, offline operation, and synchronization.

#### Scenario: Reorder active work by drag
- **WHEN** a user drags an active task before or after another task in a supported ordered scope
- **THEN** the system saves the new fractional order and displays the committed placement without opening the dragged task's editor

#### Scenario: Move into another visible Today horizon
- **WHEN** a user drops a Today to-do before or after a target to-do in another currently visible Inbox, Now, Next, or Later section
- **THEN** the system changes the dragged to-do's horizon and fractional order together and displays it at the requested target position

#### Scenario: Keep hidden Today horizons unavailable as drop targets
- **WHEN** a Today horizon has no visible work
- **THEN** the interface omits its heading and does not introduce a permanent empty drop zone for that horizon

#### Scenario: Retain non-pointer ordering
- **WHEN** a user cannot or does not use drag-and-drop
- **THEN** the interface retains keyboard and menu commands that move the focused task within the same supported scope

#### Scenario: Reorder within a Today horizon by keyboard or menu
- **WHEN** a user invokes a keyboard or menu reorder in Inbox, Now, Next, or Later
- **THEN** the system changes only that item's order within the same visible section and does not infer a cross-section destination

#### Scenario: Reorder active and inactive planning pools independently
- **WHEN** a user reorders work in Anytime or Someday
- **THEN** the system changes only that item's order within its current planning placement and does not activate, defer, schedule, or move unrelated work

#### Scenario: Withhold drag in unsupported contexts
- **WHEN** selection is active, a row mutation is pending, or the view has no manual-order contract
- **THEN** the interface does not offer a draggable task row

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
The system SHALL allow core task work to continue during temporary network loss, SHALL allow a previously loaded installed Tasks web app to reopen its interface without network access, and SHALL reconcile valid local changes when connectivity returns.

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

#### Scenario: Prepare offline launch without requesting notification permission
- **WHEN** an authenticated user opens Tasks on a supported secure client with network access
- **THEN** the client idempotently registers the Tasks service worker and stages the complete public application shell without requesting notification permission, creating a push subscription, or sending a reminder-registration mutation

#### Scenario: Reopen a previously loaded Tasks PWA offline
- **WHEN** an installed Tasks web app completed one online shell stage and later launches a `/tasks/*` route during temporary network loss
- **THEN** the service worker returns one internally consistent cached shell whose versioned application assets are available, and the Tasks runtime can open its durable local database and pending mutation queue

#### Scenario: Prepare the Home Screen installation's independent storage
- **WHEN** an iPhone or iPad user adds Tasks to the Home Screen and launches that installed app online
- **THEN** Tasks uses its permanent same-origin manifest, establishes authentication and synchronization in the Home Screen app's own browsing partition, and reports offline launch as ready only after that partition contains the active complete shell

#### Scenario: Expose incomplete offline preparation without overstating readiness
- **WHEN** the current client does not yet have an active complete Tasks shell in its own Cache Storage
- **THEN** Synchronization Details reports offline launch as preparing, failed, or unavailable instead of ready, even if another browser or installation has staged the shell

#### Scenario: Preserve the previous shell after an incomplete refresh
- **WHEN** an online Tasks navigation receives new shell HTML but one required versioned application asset cannot be staged
- **THEN** the service worker leaves the prior complete shell active, removes the incomplete staging cache, and does not make the partial deployment the offline fallback

#### Scenario: Replace a CDN-cached worker release
- **WHEN** a new backward-compatible Tasks worker is published while the hosting edge still retains the prior unversioned script response
- **THEN** the client registers the new versioned worker script URL under the existing root scope so the published worker installs without creating a competing registration or push subscription

#### Scenario: Isolate offline caching from other BathOS modules and data traffic
- **WHEN** the root-scoped Tasks service worker observes another BathOS module navigation, authentication traffic, Supabase, PowerSync, MCP, reminder-provider, or other non-shell request
- **THEN** it does not intercept or cache that request and stores no task content, owner data, credential, provider secret, or API response in Cache Storage

#### Scenario: Pause remote role probes while offline
- **WHEN** the Tasks shell opens while the browser reports that network connectivity is unavailable
- **THEN** the client retains cached authorization state, makes no administrator-role network probes, labels synchronization as offline, and resumes authorization and synchronization checks when connectivity returns

#### Scenario: Back off transient role-probe failures
- **WHEN** an administrator-role probe fails while the browser still reports online
- **THEN** the client retries with bounded exponential backoff instead of issuing a fixed high-frequency request loop

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
The system SHALL expose trustworthy synchronization state without logging task content, including first-full-sync completion, durable queue depth, last successful synchronization, upload and download activity or errors, confirmed bounded degradation and recovery episodes, and conflict receipts.

#### Scenario: Inspect synchronization details
- **WHEN** a user opens the visible task synchronization status
- **THEN** the interface reports connection mode, first-full-sync completion, durable pending-change count, last successful synchronization, upload and download activity or failure independently, recent content-free confirmed degradation and recovery episodes, and recent content-free conflict receipts

#### Scenario: Withhold a premature synchronized claim
- **WHEN** a connected Tasks installation has not completed its first full synchronization
- **THEN** the interface reports that synchronization is preparing and does not label the installation `Synced`

#### Scenario: Report a healthy synchronized installation
- **WHEN** the client is connected, has completed a full synchronization, has no transfer error, has no active transfer, and has no pending upload
- **THEN** the interface labels the installation `Synced`

#### Scenario: Upload path fails while the client is otherwise active
- **WHEN** the task upload API is unavailable but the application and synchronization stream remain active and the upload failure survives the confirmation interval
- **THEN** the client retains the queued mutation, reports the upload failure separately from its general connection state, and opens one content-free upload-error episode using the time the failure was first observed

#### Scenario: Persist another confirmed degradation
- **WHEN** the connected Tasks runtime reports a download error or an offline state that survives the confirmation interval
- **THEN** the installation opens at most one content-free episode for that degradation category using the time it was first observed, without storing a raw error, owner identifier, record identifier, task content, or source metadata

#### Scenario: Ignore a transient synchronization blip
- **WHEN** an upload error, download error, or offline state clears or changes before the confirmation interval ends
- **THEN** the interface reflects the current live state immediately but does not persist a degradation or recovery episode for the transient state

#### Scenario: Report persistent production degradation once
- **WHEN** one confirmed upload-error, download-error, or offline episode remains active for at least 2 minutes from its first observation in the production Tasks runtime
- **THEN** the client sends Sentry one fixed content-free warning with allowlisted category and bounded state tags and records that the episode was reported

#### Scenario: Recover synchronization
- **WHEN** a confirmed explicit degradation clears or changes category
- **THEN** the client closes the prior episode with a resolution time, retains it in bounded local history, and does not report that episode again

#### Scenario: Reload during an active episode
- **WHEN** Tasks reloads while a content-free confirmed degradation episode remains open
- **THEN** the runtime resumes the same episode and its remaining report delay instead of creating or reporting a duplicate

#### Scenario: Inspect local-only storage
- **WHEN** the module has no approved synchronization endpoint
- **THEN** synchronization details identify the installation as local-only, create no remote-degradation episode, and explicitly withhold any implication of cross-device or MCP convergence

### Requirement: Recoverable History
The system SHALL provide append-only history, a projection-safe guarded 100-step task undo and redo cursor, mutation receipts, a recoverable Done queue, versioned export, verified restore, and automatic terminal-data expiry.

#### Scenario: Undo a recent change
- **WHEN** a user invokes undo for the latest supported forward task mutation after its task and history projections agree
- **THEN** the system restores the source event's prior state and synchronizes the restoration as a new valid undo mutation

#### Scenario: Undo a deep sequence
- **WHEN** the authoritative projected history contains a safe contiguous chain of supported task mutations
- **THEN** repeated Command+Z on Mac or Control+Z on Windows can walk backward through as many as 100 source mutations in reverse chronological order

#### Scenario: Redo an undone sequence
- **WHEN** one or more task mutations have been undone and no new forward mutation has invalidated redo
- **THEN** Command+Shift+Z on Mac or Control+Shift+Z on Windows reapplies the next source event's after-state as a new valid redo mutation

#### Scenario: Reconstruct task history after refresh
- **WHEN** the Tasks client starts or receives projected history rows in any arrival order
- **THEN** it reconstructs the bounded undo and redo cursor from the complete available forward, undo, and redo sequence without treating inverse events as new forward steps

#### Scenario: Wait for matching projections
- **WHEN** the cursor-tip event and its current task snapshot do not yet represent the required exact undo or redo pair
- **THEN** the client withholds that history movement until synchronization makes the pair safe and does not skip to an older event

#### Scenario: Invalidate redo after a new change
- **WHEN** a user makes a new supported forward task mutation after undoing one or more events
- **THEN** the client clears the redo path and retains the new mutation in the bounded undo path

#### Scenario: Keep undo and redo out of persistent header chrome
- **WHEN** the Tasks planning header renders
- **THEN** it does not expose visible Undo, Redo, or selection-mode buttons and leaves these interactions discoverable through Keyboard Commands

#### Scenario: Preserve native text history
- **WHEN** focus is in an input, textarea, select, content-editable surface, editor, or unrelated dialog
- **THEN** Tasks does not intercept native undo or redo keyboard commands

#### Scenario: Withhold unavailable or unsafe history movement
- **WHEN** no corresponding authoritative source event is projected, an inverse is pending, or current task state no longer matches the required source snapshot
- **THEN** the web interface does not submit a duplicate or speculative undo or redo mutation

#### Scenario: Reject an unsafe inverse
- **WHEN** intervening changes make an undo or redo snapshot pairing unsafe
- **THEN** the system rejects the inverse without overwriting current data and returns a conflict receipt

#### Scenario: Return a mutation receipt
- **WHEN** the system accepts, rejects, or treats a task mutation as a no-op
- **THEN** it returns a content-free receipt with the client mutation identifier, actor, channel, affected stable identifiers, revisions, transition, timestamp, outcome, and applicable code

#### Scenario: Delete a task
- **WHEN** a user deletes a to-do or project through the normal interface
- **THEN** the system moves it to a recoverable deleted state rather than immediately erasing it

#### Scenario: Restore deleted work
- **WHEN** a user restores a recoverably deleted item
- **THEN** the system restores the item and its supported descendants to their prior lifecycle, planning, parent, and order values when those destinations remain valid

#### Scenario: Restore work whose container no longer exists
- **WHEN** a recoverably deleted root cannot return to its prior container
- **THEN** the system restores the hierarchy to Anytime and reports the fallback in the mutation receipt

#### Scenario: Export task data
- **WHEN** a user requests an export
- **THEN** the system produces a versioned checksummed JSON envelope containing active and retained Done data without credentials or delivery tokens

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
- **THEN** the system limits replacement to the complete current export schema, returns a checksum-verified pre-restore server backup, requires that backup to be downloaded plus a separate exact confirmation, and atomically replaces task data only while the server snapshot still matches the downloaded backup digest

#### Scenario: Prepare replacement without blocking task writes globally
- **WHEN** an authenticated user validates an incoming replacement and requests the current pre-restore backup
- **THEN** preparation reads one transaction-consistent snapshot without taking a table-wide task write lock, while confirmed replacement retains the atomic lock and stale-backup check

#### Scenario: Reject a stale replacement backup
- **WHEN** synchronized task data changes after the pre-restore backup is prepared and before replacement executes
- **THEN** the server rejects the stale backup digest without deleting or restoring any task record and requires a fresh preparation

#### Scenario: Recover from replacement failure
- **WHEN** a validated replacement envelope cannot be restored because of a stable-identifier collision or another transactional failure
- **THEN** the complete deletion and restore transaction rolls back, the prior owner task graph remains visible, and an exact ambiguous-response retry either resumes safely or returns the original content-free receipt

#### Scenario: Preserve delivery registration during replacement
- **WHEN** task data is replaced
- **THEN** the system removes task-specific reminder delivery diagnostics while retaining excluded browser delivery targets and credentials so the current device does not become silently unregistered

#### Scenario: Recover work from Done
- **WHEN** a user restores deleted work or reopens completed or canceled work before its purge boundary
- **THEN** the system returns the work to a valid active state and removes it from Done

#### Scenario: Retain work for 30 full local days
- **WHEN** work enters Done on an owner's local calendar date
- **THEN** the system retains it throughout that date and the following 30 local midnights

#### Scenario: Purge at the start of the 31st day
- **WHEN** the owner's planning time zone reaches midnight beginning the 31st calendar day after work entered Done
- **THEN** the server permanently erases the terminal content graph within one minute and the deletion converges to connected and later-reconnected clients

#### Scenario: Preserve safety receipts after purge
- **WHEN** purged work originated from idempotent capture, a template, recurrence, or a hierarchy operation
- **THEN** the system retains only content-free receipts required to prevent duplicate recreation and removes personal task content, sources, reminders, and terminal history not required for that safety

#### Scenario: Read an older export
- **WHEN** a user previews a supported older export containing Inbox, Today, daytime, evening, Logbook, or Trash state
- **THEN** the system deterministically normalizes it to Anytime, Today membership, and Done before reporting inserts, matches, and conflicts

#### Scenario: Replace from a verified backup
- **WHEN** a user confirms replacement from a compatible verified export
- **THEN** the system creates a pre-restore backup, replaces the synchronized task graph atomically, and preserves the authenticated owner boundary

### Requirement: Layered Reminder Delivery
The system SHALL keep the server authoritative for reminder scheduling and logical delivery identity while supporting Web Push, in-app delivery, and later native delivery targets through one idempotent contract.

#### Scenario: Schedule reminder delivery
- **WHEN** a reminder instant is accepted
- **THEN** the server creates one stable logical delivery occurrence and targets each registered delivery endpoint idempotently

#### Scenario: Manage a project reminder from the web
- **WHEN** a user saves or clears a reminder from an open project detail
- **THEN** the web interface uses the existing project-root reminder contract, owner planning time zone, daylight-saving ambiguity choice, connected-only mutation gate, and visible degraded-state explanation

#### Scenario: Report an in-app reminder claim failure
- **WHEN** an open connected client cannot claim due reminder deliveries
- **THEN** the interface shows a content-free degraded state, preserves scheduled reminders and any previously claimed items, and exposes a bounded explicit retry

#### Scenario: Bound a stalled in-app reminder claim
- **WHEN** a connected client's due-reminder claim does not settle within the configured request window
- **THEN** the client aborts the request, reports the content-free failure state, releases its in-flight guard, and leaves Retry available without changing reminder schedules or previously claimed items

#### Scenario: Report a reminder acknowledgement failure
- **WHEN** a visible or notification-opened reminder cannot be acknowledged
- **THEN** the interface reports fixed content-free failure copy, preserves the reminder for retry, and does not expose the underlying provider or transport error

#### Scenario: Protect schedules while the reminder projection is untrustworthy
- **WHEN** current reminder data is loading or fails to load
- **THEN** to-do and project reminder editors distinguish that state from local-only operation, disable reminder mutation, and do not treat an unknown current schedule as an empty schedule

#### Scenario: Read synchronized reminder time precision
- **WHEN** synchronization represents a canonical PostgreSQL reminder time with fractional-second precision
- **THEN** the client accepts it as the original wall-clock intent, renders the Tasks route, and does not reject the reminder projection

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
- **THEN** the client reuses the Tasks service-worker registration to create one standards-based push subscription, the server stores its provider credentials outside the synchronized target projection, and repeated registration reuses the target identity

#### Scenario: Transfer one browser subscription between accounts
- **WHEN** a browser endpoint is registered by a different signed-in owner on the same installation
- **THEN** the server cancels pending delivery for the prior owner, removes the prior provider credential, marks the prior target revoked, and assigns that endpoint only to the current owner

#### Scenario: Invalidate browser delivery on sign-out
- **WHEN** a signed-in owner signs out from Tasks or another BathOS route on an installation with a browser subscription
- **THEN** the installation unsubscribes before completing sign-out, and the Tasks route also revokes the owner-scoped server target when that authenticated operation is available

#### Scenario: Inspect Web Push without implicit subscription
- **WHEN** a connected user opens Tasks before enabling browser reminders
- **THEN** the client may register or inspect the shared Tasks service worker for offline launch but does not request notification permission, create a push subscription, or register a delivery target until the user invokes Enable

#### Scenario: Keep browser reminder failures content-free
- **WHEN** browser-reminder inspection, registration, or revocation fails
- **THEN** the interface reports fixed degraded capability and operation-failure copy, does not expose the underlying provider or transport error, keeps in-app reminders available, and permits an explicit retry when safe

#### Scenario: Report delivery outcome
- **WHEN** a notification provider accepts a delivery request
- **THEN** the system records provider acceptance separately from user acknowledgement and does not claim that the user saw the reminder

#### Scenario: Fail to record a provider outcome
- **WHEN** the dispatcher cannot persist the provider-accepted or failed outcome after attempting delivery
- **THEN** the invocation reports failure with content-free diagnostics and does not report a fully successful run

#### Scenario: Reject an untrusted Web Push endpoint
- **WHEN** a claimed Web Push subscription endpoint is not an HTTPS endpoint owned by an approved browser push provider
- **THEN** the dispatcher makes no network request, records a content-free terminal failure, and revokes the target so it is not retried

#### Scenario: Prepare production Web Push configuration
- **WHEN** reminder delivery is activated in a production environment
- **THEN** the server and web build use one verified public VAPID key, the server keeps the matching private key and an independent high-entropy dispatch secret outside the repository, and the scheduled request resolves its matching header value from managed secrets without embedding it in the Cron command

#### Scenario: Acknowledge an opened notification
- **WHEN** the user opens a Web Push notification for a logical occurrence
- **THEN** the authenticated Tasks route acknowledges that occurrence and later in-app or provider claims do not create another delivery after acknowledgement

#### Scenario: Open a reminder without replacing unrelated BathOS work
- **WHEN** a user opens a Web Push notification while browser windows include another BathOS module, an existing Tasks route, or no Tasks route
- **THEN** the service worker accepts only a same-origin Tasks destination, reuses and focuses an existing Tasks client when available, otherwise opens a new Tasks window, and never navigates the unrelated BathOS module away from its current route

#### Scenario: Activate a published reminder worker promptly
- **WHEN** a backward-compatible Tasks reminder and offline-shell service worker update installs while BathOS tabs remain open
- **THEN** the worker requests immediate activation so future offline launch, push, and notification-click events use the published behavior without requiring every existing BathOS tab to close

### Requirement: Evidence-Gated Native Apple Expansion
The system SHALL treat native Apple surfaces as an optional extension of the shared task domain and SHALL require a specific observed workflow gap before creating a native companion.

#### Scenario: Continue without a native companion
- **WHEN** the installed web app, Web Push, and Raycast adequately support the observed daily workflows
- **THEN** the system continues the parallel-use trial without creating a native client, Apple extension, or permanent bundle identity

#### Scenario: Diagnose a reminder incident before adding native push
- **WHEN** a production reminder is missed, duplicated, or materially late
- **THEN** the evaluation first verifies schedule computation, permission, target registration, provider outcome, and device state, and approves a native push target only when the remaining failure is a browser delivery limitation

#### Scenario: Approve one native system surface
- **WHEN** parallel use identifies a recurring gap served by a specific widget, control, App Intent, notification target, or distribution path
- **THEN** the approved implementation is limited to the smallest native host and extensions that resolve that gap while reusing the shared ownership, mutation, synchronization, and reminder contracts

#### Scenario: Avoid a second task product
- **WHEN** a native surface reads or mutates task data
- **THEN** it uses the authoritative task-domain contract and does not introduce an independent task database, reminder scheduler, or generic mutation API

### Requirement: Cross-Platform Task Interaction Reference
The system SHALL present a visible interaction reference that documents supported Tasks keyboard and pointer commands for both Mac and Windows while development validation is in progress.

#### Scenario: Compare platform commands
- **WHEN** the user opens Keyboard Commands
- **THEN** the interface shows Action, Mac, and Windows columns simultaneously and identifies the current platform when the runtime can detect it

#### Scenario: Discover direct list interactions
- **WHEN** the interaction reference is open
- **THEN** it documents undo, redo, modifier-click selection, anchored Shift-click range selection, ordinary selection toggling, drag reordering, and the existing keyboard task commands

#### Scenario: Preserve commands outside supported contexts
- **WHEN** an editable control, composition event, unrelated dialog, or unsupported task view owns an interaction
- **THEN** the reference does not imply that Tasks will override native editing, browser, or unsupported ordering behavior

### Requirement: Keyboard-First Daily Operation
The system SHALL provide modifier-based keyboard operation for full-editor creation, editing, Today planning, direct view navigation, list traversal, lifecycle transitions, find, and dialogs while suppressing every matching browser-level command inside the mounted Tasks module.

#### Scenario: Navigate without a pointer
- **WHEN** a keyboard user moves through a task view
- **THEN** focus remains visible and predictable across every interactive control

#### Scenario: Complete selected work
- **WHEN** a user invokes Control+D on Mac or Control+Shift+D on Windows while a to-do is open
- **THEN** the system toggles that to-do's pending completion state without closing its editor or transitioning it to Done

#### Scenario: Toggle completion with Command K
- **WHEN** a user presses Command+K on Mac or Control+K on Windows with an open task
- **THEN** Tasks toggles the same pending completion state as the platform's Control+D completion command and suppresses the matching browser command

#### Scenario: Complete a bulk selection with Command K
- **WHEN** a user presses Command+K on Mac or Control+K on Windows while a nonempty task multi-selection owns task commands
- **THEN** Tasks completes every selected open-lifecycle task through the ordinary lifecycle path and suppresses the matching browser command

#### Scenario: Invoke a task command safely
- **WHEN** focus is on a task title and no editor, unrelated modal, or composition event owns keyboard input
- **THEN** Enter retains ordinary button activation, Option+Up or Option+Down on Mac and Alt+Up or Alt+Down on Windows reorder within the current scope, and no unmodified letter or arrow key triggers a Tasks command

#### Scenario: Preserve keyboard focus after a task leaves the view
- **WHEN** completion, cancellation, movement, or recoverable deletion removes the focused task from the current view
- **THEN** focus moves to the task now occupying the same visual position, then the prior task, then the primary view heading when no task remains

#### Scenario: Open task creation, find, or keyboard help
- **WHEN** a keyboard user presses Command+N, Command+F, or Command+/ on Mac, or Control+N, Control+F, or Control+/ on Windows
- **THEN** the module respectively opens a blank task in the complete editor, opens quick find, or opens the keyboard-command reference and suppresses the matching browser command

#### Scenario: Create through the complete editor
- **WHEN** Command+N or Control+N is invoked from Today, Upcoming, Anytime, or Someday
- **THEN** Tasks removes any persistent Add a Task field, injects one blank local task draft at the top of that view, opens the ordinary complete editor, and focuses its blank title

#### Scenario: Create from outside a planning list
- **WHEN** Command+N or Control+N is invoked from Projects, Templates, Done, Config, Search, a project, or an area
- **THEN** Tasks navigates to Today and opens one blank Today Now draft in the complete editor

#### Scenario: Persist a valid draft
- **WHEN** a blank draft first obtains a nonblank title
- **THEN** Tasks creates exactly one ordinary task using the complete latest draft metadata, keeps the open row at the top until close, and routes subsequent edits through ordinary ordered autosave

#### Scenario: Preserve metadata entered before a title
- **WHEN** a user edits planning, organization, notes, Primary Link, actionability, deadline, or reminder intent before giving the draft a title
- **THEN** Tasks retains those values locally and includes them when the first nonblank title creates the task

#### Scenario: Discard an untitled draft
- **WHEN** the user closes a draft whose title never became nonblank
- **THEN** Tasks removes the local draft without creating synchronized work, history, sources, reminders, or a success toast

#### Scenario: Default a Today draft
- **WHEN** a user creates a task from Today
- **THEN** the draft begins as undated Anytime work with Today Now horizon and responds to ordinary planning keyboard commands

#### Scenario: Reconcile a new task after close
- **WHEN** a persisted draft editor closes
- **THEN** Tasks removes the temporary top projection and derives the task's membership, grouping, and order through the active view's ordinary sorting rules

#### Scenario: Explain a saved task leaving the view
- **WHEN** the final accepted metadata places a newly persisted task outside the view where it was created
- **THEN** Tasks shows one neutral toast stating that the task was saved but is not visible in the current list

#### Scenario: Submit inline hierarchy capture
- **WHEN** a keyboard user enters a nonblank area, project, project to-do, or checklist-item name and presses Enter without an active composition event
- **THEN** the corresponding hierarchy form submits exactly as its visible add button would

#### Scenario: Search and filter without unstructured labels
- **WHEN** a user searches present work or filters the result set
- **THEN** the module matches task text and structured source or hierarchy context, filters through explicit planning destination, lifecycle, all three actionability states, and source-kind fields, and does not introduce generic tags

#### Scenario: Open a task across views from search
- **WHEN** a user activates a task search result
- **THEN** the module navigates through a real in-app link to the task's current planning or history view and opens or focuses the stable task record

#### Scenario: Keep structural movement and temporal planning distinct
- **WHEN** a user invokes Command+M or Control+M, or a temporal planning command, on a focused open task
- **THEN** the organization command changes only area or project placement while temporal commands change only planning destination, start date, day horizon, due date, or reminder time

#### Scenario: Restore focus after a movement command
- **WHEN** a structural or temporal movement command succeeds and its command surface closes
- **THEN** focus returns to the moved task when it remains in the current view, or follows the same-position, prior-task, and primary-heading fallback when the move removes it

#### Scenario: Autosave free-text editing
- **WHEN** a user changes a to-do title or notes in an open editor
- **THEN** the local value changes immediately and the module persists the latest nonblank title or exact notes source after a short debounce without a Save or Cancel action

#### Scenario: Autosave structured editing
- **WHEN** a user changes actionability, organization, start date, day horizon, deadline, Primary Link, reminder time, or reminder ambiguity in an open to-do
- **THEN** the module persists the changed field immediately without waiting for another field or an explicit submission

#### Scenario: Preserve autosave order
- **WHEN** a user makes multiple edits while one or more earlier autosave writes remain in flight
- **THEN** the module submits and resolves the writes in interaction order so an earlier request cannot replace a later accepted value

#### Scenario: Flush autosave on close
- **WHEN** a user closes an editor, opens another to-do, or leaves the current task view while a free-text debounce is pending
- **THEN** the module submits the latest valid draft and waits for that ordered write before committing any deferred completion for the closing to-do

#### Scenario: Keep autosave visually quiet
- **WHEN** an autosave write is pending or succeeds
- **THEN** the editor remains interactive and shows no routine saving or saved indicator

#### Scenario: Preserve autosave history
- **WHEN** an autosave batch is accepted
- **THEN** it is recorded as an ordinary task mutation that can be traversed by app-level undo and redo across to-dos

#### Scenario: Recover from autosave failure
- **WHEN** an autosave write fails while the editor remains open
- **THEN** the module reports the failure through its existing error notice, keeps the local draft available, and permits a later edit to retry persistence

#### Scenario: Override browser commands intentionally
- **WHEN** the user invokes a documented Tasks modifier command while focus is anywhere inside the mounted Tasks route, including an editable control
- **THEN** a capture-phase handler prevents the default browser action, stops later keyboard handling, and dispatches only the Tasks command outside active composition

#### Scenario: Own app undo and redo
- **WHEN** the user presses Command+Z or Command+Shift+Z on Mac, or Control+Z or Control+Shift+Z on Windows
- **THEN** Tasks suppresses browser and text-editor history everywhere in the module and invokes the available app-level undo or redo action, otherwise performing a Tasks no-op

#### Scenario: Navigate views by number
- **WHEN** the user presses Command+1 through Command+6 or Command+Comma on Mac, or Control+1 through Control+6 or Control+Comma on Windows
- **THEN** Tasks navigates directly to Today, Upcoming, Anytime, Someday, Projects, Templates, or Config respectively and suppresses the matching browser navigation command

#### Scenario: Plan one or many tasks from the keyboard
- **WHEN** a user invokes the Today, Anytime, Someday, start date, due date, duplicate, organization, horizon, or reminder command with an open task or nonempty multi-selection
- **THEN** the module targets the multi-selection when present and otherwise targets the open task, applies the command to every eligible target, and suppresses the matching browser command

#### Scenario: Cycle Today with no Inbox transition
- **WHEN** Command+T on Mac or Control+T on Windows targets work outside Today or already in Today
- **THEN** outside work moves to canonical Today Now while Today work cycles Now to Next to Later to Now and never enters Inbox

#### Scenario: Cycle a scheduled day horizon
- **WHEN** Command+H on Mac or Control+H on Windows targets one or more tasks with future Start Dates
- **THEN** each eligible task cycles Now to Next to Later to Now without changing its Start Date

#### Scenario: Ignore an ineligible reminder command
- **WHEN** Command+E on Mac or Control+E on Windows targets no task with a Start Date
- **THEN** the module makes no reminder mutation or focus change

#### Scenario: Open the next visible to-do
- **WHEN** the user presses Control+S on Mac or Control+Shift+S on Windows
- **THEN** Tasks opens the first visible to-do when none is open, otherwise closes the current editor and opens the next visible to-do, closing without wrapping when the current to-do is last

#### Scenario: Open the previous visible to-do
- **WHEN** the user presses Control+W on Mac or Control+Shift+W on Windows
- **THEN** Tasks opens the last visible to-do when none is open, otherwise closes the current editor and opens the previous visible to-do, closing without wrapping when the current to-do is first

#### Scenario: Focus a newly opened title
- **WHEN** a pointer, search result, creation command, or keyboard traversal command opens a to-do
- **THEN** focus lands in the title input with its insertion point at the end and the page scrolls only as needed to reveal that title, never the bottom of a long editor

#### Scenario: Animate inline editor disclosure
- **WHEN** a user opens or closes a to-do and reduced motion is not requested
- **THEN** Tasks quickly animates the editor's expansion or collapse and smoothly adjusts page scroll only when needed to reveal the opened row

#### Scenario: Close an editor from outside
- **WHEN** a pointer interaction begins outside the open to-do and any calendar, menu, listbox, or dialog launched from its editor
- **THEN** Tasks flushes pending autosave, closes the editor, and commits any deferred completion through the ordinary close path

#### Scenario: Close an editor with Command Return or Escape
- **WHEN** a task editor is open and the user presses Command+Return on Mac, Control+Return on Windows, or Escape while no nested dialog or popover owns Escape
- **THEN** Tasks flushes autosave and closes the editor from any focused task field with the same deferred-completion semantics as the ordinary close path

#### Scenario: Retain an open task's list projection
- **WHEN** autosaved planning or organization metadata would remove or regroup the currently open to-do
- **THEN** Tasks keeps that row at its original visible position and group with the latest editable values until the editor closes, then applies current view membership exactly once

#### Scenario: Edit repeated planning values before closure
- **WHEN** a user changes Start Date, Day Horizon, Deadline, or Organization multiple times while the to-do remains open
- **THEN** every accepted change autosaves in order without unmounting or moving the editor, and the final accepted state controls projection after closure

#### Scenario: Reduce editor disclosure motion
- **WHEN** the operating system requests reduced motion
- **THEN** Tasks opens, closes, and reveals the editor without a visible expansion transition or smooth scrolling

#### Scenario: Defer open to-do completion
- **WHEN** a user activates the completion control while its to-do editor is open
- **THEN** the control toggles a visible pending completion state and the to-do remains open and absent from Done

#### Scenario: Commit deferred completion on close
- **WHEN** an editor with pending completion closes, navigates to another to-do, or leaves its view
- **THEN** Tasks flushes its pending autosave and transitions that to-do to Done exactly once after the editing session ends

#### Scenario: Complete a closed to-do immediately
- **WHEN** a user activates the completion control for a to-do whose editor is closed
- **THEN** Tasks immediately transitions that to-do to Done and applies the documented focus fallback

#### Scenario: Close and clear page focus
- **WHEN** the user presses Control+X on Mac or Control+Shift+X on Windows while a to-do is open
- **THEN** Tasks closes the editor, commits any pending completion, and removes focus from every page control

#### Scenario: Preserve other native input behavior
- **WHEN** focus is in an input, textarea, select, content-editable surface, menu, or dialog and the key chord is not a documented Tasks command
- **THEN** native typing, composition, selection, Tab traversal, and control behavior remain available

#### Scenario: Traverse a task and its complete editor
- **WHEN** a keyboard user advances or reverses focus through a task row or expanded task editor
- **THEN** every available interactive control receives visible focus in documented order and unavailable controls are skipped

#### Scenario: Announce task controls and command surfaces
- **WHEN** assistive technology inspects the task surface, an expanded editor, or a command dialog
- **THEN** every interactive control has a nonempty programmatic name, stateful controls expose their current state, and each dialog has a programmatic title without a dangling description reference

#### Scenario: Keep task header controls inside a narrow mobile viewport
- **WHEN** a task planning view is rendered at 390 CSS pixels wide
- **THEN** the view title and header actions remain fully inside the document viewport without horizontal page overflow, while compact icon-only links retain nonempty programmatic names

#### Scenario: Respect reduced-motion preference
- **WHEN** the operating system requests reduced motion while the Tasks route is mounted
- **THEN** task-page and portal animations, transitions, delays, and smooth scrolling are reduced without changing the motion policy of unrelated BathOS routes

#### Scenario: Open global quick entry on Mac
- **WHEN** the user invokes the configured Raycast task-entry hotkey
- **THEN** Raycast presents required title and optional notes inputs without requiring the BathOS browser tab to be focused

#### Scenario: Capture from Raycast
- **WHEN** the user submits a nonempty title through Raycast quick entry
- **THEN** the authenticated task service creates exactly one undated Anytime to-do with Today Later horizon and `raycast` entry provenance, then returns an accepted or already-applied receipt

#### Scenario: Authorize Raycast safely
- **WHEN** the Raycast command has no usable delegated credential
- **THEN** it performs browser-based Authorization Code with S256 PKCE and retains the rotating refresh credential in the macOS login Keychain without storing a BathOS password, browser session, service-role credential, or client secret

#### Scenario: Retry a capture safely
- **WHEN** delivery of a submitted Raycast capture is retried after an ambiguous response
- **THEN** the command reuses that capture's creation UUID and the service does not create a duplicate to-do

#### Scenario: Capture the active browser page
- **WHEN** the user invokes page capture while Safari, Safari Technology Preview, Google Chrome, or Google Chrome Canary has a normal HTTP(S) active tab
- **THEN** the system creates one undated Anytime to-do with Today Later horizon, a cleaned deterministic title, `browser_capture` entry provenance, and a typed `webpage` source containing the exact accepted URL and optional browser title

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
- **THEN** the system creates one undated Anytime to-do with Today Later horizon, `raycast` entry provenance, the selected item's name, and a typed `file` source whose local `file://` reference is treated as originating-Mac context rather than a portable cross-device identifier

#### Scenario: Reject an ambiguous Finder selection
- **WHEN** Finder has no selected item or more than one selected item
- **THEN** Finder capture explains that exactly one item is required and does not submit a task mutation

#### Scenario: Capture a reading item
- **WHEN** the user invokes reading-list capture on a supported normal browser page
- **THEN** the command uses the verified AI webpage-title workflow with its deterministic fallback and creates one unassigned undated Anytime to-do with Today Later horizon, `browser_capture` entry provenance, a typed `reading_item` source, and the source URL in notes

#### Scenario: Present reading provenance structurally
- **WHEN** reading-list capture creates a to-do
- **THEN** the title does not retain the legacy glasses prefix because reading provenance is authoritative in the typed source

#### Scenario: Preserve Mail source identity and lifecycle
- **WHEN** a future specialized Mail capture atomically creates a task and its Mail source record
- **THEN** the owner-scoped source record preserves the task relationship, account and mailbox identifiers, durable message identifier, `message://` deep link, retirement destination, explicit retirement lifecycle, revision, and mutation identifier without storing Mail content

#### Scenario: Create a processed Mail task
- **WHEN** authenticated Mail capture supplies AI-processed title and notes, complete source identity, retirement destination, and optional verified work-area assignment
- **THEN** the specialized service creates one unassigned or area-assigned undated Anytime task with Today Next horizon, an editable Primary Link initialized from the Mail deep link, and a retained source record in one transaction with no generic fallback write

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

#### Scenario: Navigate task views
- **WHEN** the user presses the documented Command+number or Control+number chord
- **THEN** the interface navigates directly to Today, Upcoming, Anytime, Someday, Projects, Templates, or Config while suppressing browser tab-number behavior

#### Scenario: Search tasks and views
- **WHEN** the user activates the visible Search Tasks and Views control
- **THEN** a dialog searches owner-scoped tasks and current views and supports keyboard selection without exposing retired Inbox, Logbook, or Trash destinations

#### Scenario: Preserve native editing behavior
- **WHEN** focus is inside an input, textarea, select, content-editable surface, menu, or dialog
- **THEN** undocumented key chords do not replace native typing, composition, selection, or control behavior, while documented Tasks modifier commands retain precedence

### Requirement: Global Task Quick Find
The system SHALL provide a keyboard-first quick find across to-dos, projects, and areas and a live full task-results route.

#### Scenario: Show the best quick matches
- **WHEN** a user types a substring in quick find
- **THEN** the surface updates with each keystroke and presents at most three matching to-do, project, or area results with their entity types

#### Scenario: Close quick find
- **WHEN** quick find is visible and the user presses Escape
- **THEN** the surface closes without changing task data

#### Scenario: Continue a search
- **WHEN** the user activates Continue Search
- **THEN** the module navigates through a real in-app link to `/tasks/search` with the current query and lists every matching to-do from every planning and lifecycle view

#### Scenario: Refine full results
- **WHEN** the user edits the query on the search-results page
- **THEN** the URL query and full to-do results update with each keystroke

#### Scenario: Open a hierarchy result
- **WHEN** the user activates a project or area quick-find result
- **THEN** a real in-app link opens that hierarchy record and preserves modified-click behavior

### Requirement: Task Duplication
The system SHALL duplicate active to-dos from an open task or multi-selection without copying immutable provenance or automation identity.

#### Scenario: Duplicate mutable task content
- **WHEN** the user invokes the duplicate command for one or more open present tasks
- **THEN** the system creates one new task per source with the same user-editable title, notes, actionability, planning, container, deadline, and Primary Link

#### Scenario: Exclude nonduplicable identity
- **WHEN** a duplicate task is created
- **THEN** it receives new record, mutation, order, and history identity and does not copy typed source, idempotency, reminder, recurrence, completion, cancellation, or deletion state

### Requirement: Task Row Temporal Metadata
The system SHALL distinguish Start and Due metadata in task rows with semantic Lucide icons and time-direction copy.

#### Scenario: Show temporal types
- **WHEN** a task row presents a Start Date or Due Date
- **THEN** Start uses the Lucide Play icon and Due uses the Lucide FlagTriangleRight icon

#### Scenario: Describe a future start
- **WHEN** Upcoming presents a task whose Start Date is two days after the planning date
- **THEN** the row presents the Play icon and the copy `In 2 days` rather than remaining-time copy

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

### Requirement: Large-Library Responsiveness
The system SHALL retain bounded task-view and search latency as active and historical task data grows beyond the owner's current library.

#### Scenario: Derive task views at synthetic scale
- **WHEN** the performance harness derives Today, Upcoming, Anytime, Someday, or Done from 10,000 mixed synthetic records
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

### Requirement: BathOS Product Expression
The system SHALL use BathOS's direct module naming, shared visual language, copy, assets, and interaction conventions while preserving the functional planning principles selected for the Tasks module.

#### Scenario: Design a familiar planning concept
- **WHEN** the module implements a concept also present in Things
- **THEN** the implementation uses BathOS conventions and original expression rather than copying Cultured Code branding or assets

#### Scenario: Identify the module directly
- **WHEN** the module appears in the BathOS launcher or install metadata
- **THEN** it is named `Tasks` and uses the standard BathOS monochrome treatment of Lucide `SquareCheckBig`

### Requirement: Stable Tasks Route Runtime
The system SHALL preserve one authenticated Tasks runtime and synchronization session while navigating among supported routes inside the Tasks module.

#### Scenario: Navigate between planning views
- **WHEN** a user follows a plain in-app link from one supported Tasks planning view to another
- **THEN** the URL and rendered view change without closing or recreating the Tasks local database, synchronization connector, reliability observer, or reminder polling lifecycle

#### Scenario: Navigate to hierarchy details
- **WHEN** a user opens a project or area detail from the Tasks hierarchy
- **THEN** the registered detail route renders inside the existing Tasks runtime and preserves real-link browser behavior

#### Scenario: Reject an unknown Tasks route
- **WHEN** navigation reaches a path under `/tasks/...` that is not a registered static, project-detail, or area-detail route
- **THEN** the application renders its normal not-found boundary and does not silently render a default Tasks view

#### Scenario: Leave the Tasks module
- **WHEN** a user navigates from Tasks to another BathOS module or signs out
- **THEN** the Tasks runtime may close its owner-bound local database and synchronization session according to the existing cleanup contract

### Requirement: Concise Tasks Navigation
The system SHALL keep Tasks navigation to five or fewer persistent destinations at every viewport and SHALL place secondary task views behind one More menu.

#### Scenario: Navigate secondary views by keyboard
- **WHEN** a keyboard user opens More and moves through its destinations
- **THEN** every destination receives visible focus, exposes a nonempty programmatic name, and can be activated without a pointer

#### Scenario: Render concise desktop navigation
- **WHEN** Tasks renders at a desktop or tablet viewport
- **THEN** persistent navigation presents Today, Upcoming, Anytime, Someday, and More without clipping, overlap, overflow, or a second row

#### Scenario: Render five mobile destinations
- **WHEN** Tasks renders below the desktop breakpoint
- **THEN** persistent mobile navigation presents exactly Today, Upcoming, Anytime, Someday, and More

#### Scenario: Open secondary destinations
- **WHEN** a user opens More
- **THEN** the menu presents Projects, Templates, Done, and Config with Lucide icons and a clear active state

#### Scenario: Preserve link behavior
- **WHEN** a user invokes a direct or overflow navigation item with an ordinary or modified click
- **THEN** the destination remains a real link, plain left click uses SPA navigation, and modified or middle click preserves browser behavior

### Requirement: Config-Owned Task Maintenance
The system SHALL keep infrequent Tasks settings, capability state, diagnostics, and recovery controls on a dedicated Config route instead of persistent daily-planning chrome.

#### Scenario: Open Tasks Config
- **WHEN** a user follows the Config destination
- **THEN** `/tasks/config` renders inside the existing Tasks runtime and presents Browser Reminders, Synchronization, and Backup and Restore sections

#### Scenario: Keep daily views concise
- **WHEN** a user opens Today, Upcoming, Anytime, Someday, Projects, Templates, Done, or Config
- **THEN** the page does not persistently render browser-reminder capability, synchronization diagnostics, backup/restore, or duplicate Projects and Templates shortcuts

#### Scenario: Preserve actionable reminder failures
- **WHEN** the current client cannot claim or project due reminder work
- **THEN** the daily task surface retains its existing content-free failure and retry behavior even though browser-reminder capability is managed on Config

#### Scenario: Manage browser reminders
- **WHEN** a user opens Browser Reminders on Config
- **THEN** the interface reports the current capability and exposes only the safe enable or disable action available under the existing reminder contract

#### Scenario: Inspect synchronization
- **WHEN** a user opens Synchronization Details from Config
- **THEN** the existing connection, offline-launch, health, full-sync, queue, activity, reliability-event, and conflict-receipt evidence remains available

#### Scenario: Manage data portability
- **WHEN** a user opens Backup and Restore from Config
- **THEN** the existing verified export, merge, replacement, and safety behavior remains available without a persistent module-header control

### Requirement: Concise Task View Presentation
The system SHALL use the active view name, compact self-evident controls, progressive disclosure, and small structured day-horizon markers so routine browsing remains uncluttered.

#### Scenario: Name the active view
- **WHEN** any supported Tasks route renders
- **THEN** the primary heading identifies Today, Upcoming, Anytime, Someday, Projects, Project, Area, Templates, Done, or Config at every viewport

#### Scenario: Create an area progressively
- **WHEN** a user activates Add Area from Projects
- **THEN** a title-only BathOS form dialog requests the required area title, disables Save til the title is nonblank, supports Enter submission and complete keyboard traversal, and restores focus to Add Area after close

#### Scenario: Create a project progressively
- **WHEN** a user activates Add Project from Projects
- **THEN** a title-only BathOS form dialog requests the required project title and optional area, disables Save til the title is nonblank, supports Enter submission and complete keyboard traversal, and restores focus to Add Project after close

#### Scenario: Browse projects without setup clutter
- **WHEN** the Projects view is not creating an area or project
- **THEN** it shows compact icon-only Add Area and Add Project controls with nonempty programmatic names and does not render permanent creation fields

#### Scenario: Mark a resolved day horizon
- **WHEN** an active Anytime or deferred Upcoming row has an Inbox, Now, Next, or Later horizon
- **THEN** the row displays compact Lucide iconography with a nonempty accessible name identifying that horizon without repeating a verbose sentence

#### Scenario: Omit an unavailable day-horizon marker
- **WHEN** an undated Anytime row has a null day horizon
- **THEN** the row does not reserve empty marker space or show a decorative icon

#### Scenario: Summarize nearby calendar dates relatively
- **WHEN** a displayed Start Date, Deadline, or reminder date differs from the owner-local planning date by no more than 10 days
- **THEN** the row uses Today, Tomorrow, one day ago, N days ago, or N days left as appropriate

#### Scenario: Summarize distant calendar dates compactly
- **WHEN** a displayed date is more than 10 days before or after the owner-local planning date
- **THEN** the row uses a short month and numeric day such as Aug 27

#### Scenario: Arrange the open editor compactly
- **WHEN** a to-do editor is open
- **THEN** Actionability and Organization share one responsive row, temporal controls use one compact responsive row with no full-width reminder container, and Deadline follows on the next row

#### Scenario: Browse Done without archive ceremony
- **WHEN** a user opens Done
- **THEN** the interface shows retained terminal work in reverse terminal order with its terminal reason, date, and one appropriate restore or reopen action

#### Scenario: Create hierarchy progressively
- **WHEN** a user creates an area or project from Projects
- **THEN** compact icon-only controls open title-only keyboard-complete BathOS dialogs and restore trigger focus after close

### Requirement: Module Isolation
The task module SHALL remain removable without importing code from another BathOS module or requiring another module's data.

#### Scenario: Use shared BathOS infrastructure
- **WHEN** the task module needs authentication, layout, UI primitives, or general utilities
- **THEN** it uses shared platform, component, or library surfaces rather than importing another module

#### Scenario: Remove the task module
- **WHEN** the task module's files, routes, launcher entry, and `tasks_` database objects are removed
- **THEN** unrelated BathOS modules continue to function

### Requirement: Legacy Task Planning Migration
The system SHALL migrate retired planning and terminal vocabulary without losing task content, provenance, hierarchy, reminders, recurrence, history, or stable identity.

#### Scenario: Migrate Inbox work
- **WHEN** the migration encounters an Inbox to-do
- **THEN** it becomes Anytime and Today Later with its stable identifiers and content unchanged

#### Scenario: Migrate current Today work
- **WHEN** the migration encounters eligible daytime or evening Today work
- **THEN** it becomes Anytime and Today Next or Later respectively

#### Scenario: Migrate future Today work
- **WHEN** the migration encounters Today work whose start date is after the owner's current planning date
- **THEN** it becomes future Anytime work with no Today membership and remains in Upcoming

#### Scenario: Retire old routes
- **WHEN** a user opens `/tasks/inbox`, `/tasks/logbook`, or `/tasks/trash`
- **THEN** the router replaces the location with `/tasks/today` or `/tasks/done` and never renders a retired view

### Requirement: Deferral-Anchored Reminder Time
The system SHALL allow at most one active reminder per to-do or project, SHALL derive its calendar date from that item's future-only start date, and SHALL expose only its local time as user-editable reminder intent.

#### Scenario: Add a reminder to scheduled work
- **WHEN** a user assigns a reminder time to an open item with a start date
- **THEN** the system resolves one reminder on that start date in the owner's planning time zone and does not request or store an independently chosen reminder date

#### Scenario: Withhold reminders from undated work
- **WHEN** an open item has no start date
- **THEN** the interface hides Reminder Time and every mutation surface rejects a new reminder for that item

#### Scenario: Clear a future start date with a reminder
- **WHEN** a user manually clears the future start date from an item that has an active reminder
- **THEN** the system cancels its reminder and pending occurrence while retaining or clearing its day horizon according to the requested active placement

#### Scenario: Activate work without losing its same-day reminder
- **WHEN** the owner-local start date arrives before the item's resolved reminder time
- **THEN** activation clears the parent start date, retains its day horizon, and preserves the already-scheduled occurrence so it remains deliverable that day

#### Scenario: Move the start date with a reminder
- **WHEN** a user changes an item's start date while retaining its reminder time
- **THEN** the system re-resolves the reminder against the new date and replaces the prior pending occurrence exactly once

#### Scenario: Normalize existing reminder data
- **WHEN** the start-anchored reminder migration encounters an active reminder
- **THEN** it rebinds that reminder to its parent's start date when present and cancels it when the parent is undated without deleting the parent item

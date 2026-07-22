## ADDED Requirements

### Requirement: Independent Task Day Horizon
The system SHALL persist a to-do or project day horizon independently from its start date and SHALL support `none`, `inbox`, `now`, `next`, and `later` without treating the physical field as a second date or reminder time.

#### Scenario: Retain a future day horizon
- **WHEN** a user assigns a future start date and Inbox, Now, Next, or Later to an Anytime to-do or project
- **THEN** the system keeps the item in Upcoming until its owner-local start date and retains the selected day horizon unchanged

#### Scenario: Default due unclassified work to Inbox
- **WHEN** an open present Anytime item with a stored `none` horizon reaches its owner-local start date
- **THEN** the system includes it in Today Inbox without rewriting its stable identity, hierarchy, date, or stored horizon

#### Scenario: Keep undated unclassified work outside Today
- **WHEN** an open present Anytime item has no start date and a stored `none` horizon
- **THEN** the system includes it in Anytime and withholds it from Today

#### Scenario: Preserve horizon through structured generation and portability
- **WHEN** templates, recurrence, MCP, export, merge, replacement restore, or synchronization carry an Anytime item's planning state
- **THEN** the system validates and preserves its independent day horizon, including a horizon selected for a future start date

## MODIFIED Requirements

### Requirement: Core Task Organization
The system SHALL organize active work through Anytime, Someday, areas, projects, headings, to-dos, and checklist items without requiring a separate Inbox destination or generic tags.

#### Scenario: Organize work in a project
- **WHEN** a user places a to-do under a project and optional heading
- **THEN** the to-do appears in that hierarchy and retains its stable identity and planning membership

#### Scenario: Organize ongoing responsibility
- **WHEN** a user places a project or loose to-do in an area
- **THEN** the system includes the item in that area's active work

#### Scenario: Review active work in an area
- **WHEN** a user opens an area from Projects
- **THEN** the interface presents that owner's present open loose to-dos and projects, preserves real links to project details and each to-do's current planning view, and excludes Done or unrelated work

#### Scenario: Keep project membership canonical
- **WHEN** a to-do belongs to a project whose area changes
- **THEN** the to-do remains in the project, derives its area from that project, and does not receive a competing direct area assignment

#### Scenario: Organize a project with headings
- **WHEN** a user places a to-do under a heading in a project
- **THEN** the heading belongs to that same project and the system rejects cross-project or cross-owner hierarchy references

#### Scenario: Keep project identity legible beside lifecycle controls
- **WHEN** a project with a long title is opened at 390 CSS pixels wide
- **THEN** the complete project title occupies its own mobile row without overlapping or collapsing behind Complete, Cancel, Reopen, or Delete actions, and the actions remain fully operable

#### Scenario: Move a to-do between containers
- **WHEN** a user moves a to-do to an area, project, heading, or no container
- **THEN** the system clears incompatible parent references, preserves the to-do's stable identity and planning state, and assigns an order within the new hierarchy scope

#### Scenario: Maintain a checklist
- **WHEN** a user adds, edits, reorders, completes, reopens, or recoverably removes a checklist item
- **THEN** the checklist item remains owned by exactly one to-do and its completion state remains independent from the parent to-do's lifecycle

#### Scenario: Order hierarchy independently from planning views
- **WHEN** a user reorders an area, project, heading, project to-do, loose area to-do, or checklist item
- **THEN** the system changes only the selected item's hierarchy order and does not change its order or membership in Today, Anytime, Someday, Upcoming, or Done

#### Scenario: Capture new work for triage
- **WHEN** a user or supported integration creates a to-do without an explicit planning placement
- **THEN** the system creates one open present Anytime to-do marked for Today Inbox

### Requirement: Date-Based Planning Views
The system SHALL derive Today, Upcoming, Anytime, Someday, and Done from task state, start dates, independent day horizons, and terminal timestamps.

#### Scenario: Defer work to a future date
- **WHEN** a user assigns a future start date to a to-do or project
- **THEN** the system includes the item in Upcoming, withholds it from Today and Anytime until its owner-local start date arrives, and preserves its selected day horizon

#### Scenario: Store an uncommitted possibility
- **WHEN** a user assigns a to-do or project to Someday
- **THEN** the system clears its start date and day horizon and withholds it from Today, Upcoming, and Anytime

#### Scenario: Activate Someday work
- **WHEN** a user moves a Someday item to Anytime without a start date
- **THEN** the system changes its destination to Anytime and includes it in Anytime without automatically assigning a day horizon

#### Scenario: Schedule Someday work
- **WHEN** a user assigns a start date and optional day horizon to Someday work
- **THEN** the system changes its destination to Anytime, includes it in Upcoming or available views according to that date, and preserves the chosen horizon

#### Scenario: Mark undated Anytime work for Today
- **WHEN** a user places undated available Anytime work in Inbox, Now, Next, or Later
- **THEN** the system keeps the same stable item in Anytime and also includes it in the selected Today section

#### Scenario: Review the Today projection
- **WHEN** a user opens Today
- **THEN** the system shows eligible open present Anytime work and groups it in Inbox, Now, Next, and Later order

#### Scenario: Review the Anytime pool
- **WHEN** a user opens Anytime
- **THEN** the system shows every available open present Anytime item and marks its resolved Inbox, Now, Next, or Later placement when it also appears in Today

#### Scenario: Review a future horizon
- **WHEN** a user opens Upcoming for an item with a future start date
- **THEN** the interface preserves and exposes its selected Inbox, Now, Next, or Later horizon without showing the item in Today early

#### Scenario: Remove undated work from Today
- **WHEN** a user removes Today placement from an undated to-do
- **THEN** the system records the `none` horizon, removes the to-do from Today, and keeps it in Anytime without changing its identity or container

#### Scenario: Activate deferred work
- **WHEN** an Anytime item reaches its owner-local start date
- **THEN** the system includes it in Anytime and Today under its selected horizon or Inbox when its horizon is `none`

#### Scenario: Complete, cancel, or delete work
- **WHEN** a user completes, cancels, or deletes a to-do or supported hierarchy root
- **THEN** the system removes it from active planning views and includes it in Done until recovery or automatic purge

### Requirement: Bulk Task Planning
The system SHALL provide an explicit accessible selection mode for open tasks and SHALL apply supported day-horizon, future scheduling, Anytime, or Someday actions to selected records as one local transaction.

#### Scenario: Select multiple visible tasks
- **WHEN** a user enters selection in Today, Upcoming, Anytime, or Someday and selects one or more visible tasks
- **THEN** the interface reports the selected count, exposes Select All and Clear, and communicates each selected state to keyboard and assistive-technology users

#### Scenario: Plan selected tasks
- **WHEN** a user applies Today Inbox, Today Now, Today Next, Today Later, Remove from Today, Tomorrow, Anytime, or Someday to selected tasks
- **THEN** the system updates every selected task's destination, day horizon, start date, mutation metadata, revision, and relevant order in one local transaction while preserving selected order

#### Scenario: Preserve a bulk horizon while scheduling
- **WHEN** a user applies a future date to selected tasks with an Inbox, Now, Next, or Later horizon
- **THEN** the system retains the requested horizon for every valid selected task while the tasks remain in Upcoming

#### Scenario: Reject one invalid bulk member
- **WHEN** any selected task is no longer open and present or the requested start date conflicts with one selected deadline
- **THEN** the system rejects the operation without writing any selected task and leaves selection available for correction or retry

#### Scenario: Keep bulk scope bounded
- **WHEN** the user exits selection, changes views, or completes a successful bulk plan
- **THEN** the client clears selection and returns to ordinary editing without adding bulk completion, deletion, or hierarchy mutation

### Requirement: Temporal Planning Semantics
The system SHALL store start dates and deadlines as local calendar dates, store an independent day horizon, derive Today from the owner's IANA planning time zone, and store reminders as unambiguous resolved instants with their original local intent.

#### Scenario: Start date and deadline coexist
- **WHEN** a to-do has both a start date and a later deadline
- **THEN** the system uses the start date to control when the to-do becomes active and retains the deadline as the completion boundary

#### Scenario: Reject an impossible date range
- **WHEN** a caller supplies a deadline earlier than the start date
- **THEN** the system rejects the mutation without partially changing temporal values

#### Scenario: Travel across time zones
- **WHEN** the owner's current or planning time zone changes
- **THEN** date-only start and deadline values remain assigned to the same calendar dates and Today eligibility follows the owner-local planning date

#### Scenario: Place work in a day horizon
- **WHEN** a user selects Inbox, Now, Next, or Later for available or future Anytime work
- **THEN** the system records the horizon without changing the start date or converting the horizon into an independent date or reminder time

#### Scenario: Edit start date and horizon together
- **WHEN** a user opens a to-do's temporal planning control
- **THEN** the interface presents Start Date and Day Horizon together, supports complete keyboard operation, and saves either field without silently clearing the other

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

### Requirement: Stable Manual Ordering
The system SHALL preserve intentional manual ordering across saves, refreshes, offline operation, and synchronization.

#### Scenario: Reorder active work
- **WHEN** a user moves an item within an ordered task view
- **THEN** the system saves the new order without changing unrelated items

#### Scenario: Reorder sections of Today independently
- **WHEN** a user reorders work in Inbox, Now, Next, or Later
- **THEN** the system changes only that item's order within the same visible section and does not move it across Today sections

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
- **WHEN** an Anytime or Upcoming row has a resolved Inbox, Now, Next, or Later horizon
- **THEN** the row displays compact Lucide iconography with a nonempty accessible name identifying that horizon without repeating a verbose sentence

#### Scenario: Omit an irrelevant day-horizon marker
- **WHEN** an undated Anytime row has no explicit day horizon
- **THEN** the row does not reserve empty marker space or show a decorative icon

#### Scenario: Browse Done without archive ceremony
- **WHEN** a user opens Done
- **THEN** the interface shows retained terminal work in reverse terminal order with its terminal reason, date, and one appropriate restore or reopen action

#### Scenario: Create hierarchy progressively
- **WHEN** a user creates an area or project from Projects
- **THEN** compact icon-only controls open title-only keyboard-complete BathOS dialogs and restore trigger focus after close

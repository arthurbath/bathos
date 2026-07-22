## MODIFIED Requirements

### Requirement: Core Task Organization
The system SHALL organize active work through Anytime, Someday, areas, projects, headings, to-dos, and checklist items without requiring Inbox or generic tags.

#### Scenario: Capture new work for triage
- **WHEN** a user or supported integration creates a to-do without an explicit planning placement
- **THEN** the system creates one open present Anytime to-do marked for Today Later

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

#### Scenario: Move a to-do between containers
- **WHEN** a user moves a to-do to an area, project, heading, or no container
- **THEN** the system clears incompatible parent references, preserves the to-do's stable identity and planning state, and assigns an order within the new hierarchy scope

#### Scenario: Maintain a checklist
- **WHEN** a user adds, edits, reorders, completes, reopens, or recoverably removes a checklist item
- **THEN** the checklist item remains owned by exactly one to-do and its completion state remains independent from the parent to-do's lifecycle

#### Scenario: Order hierarchy independently from planning views
- **WHEN** a user reorders an area, project, heading, project to-do, loose area to-do, or checklist item
- **THEN** the system changes only the selected item's hierarchy order and does not change its order or membership in Today, Anytime, Someday, Upcoming, or Done

### Requirement: Date-Based Planning Views
The system SHALL derive Today, Upcoming, Anytime, Someday, and Done from task state, start dates, Today membership, and terminal timestamps.

#### Scenario: Mark Anytime work for Today
- **WHEN** a user places an available Anytime to-do in Now, Next, or Later
- **THEN** the system keeps the to-do in Anytime and also includes the same stable record in the selected Today section

#### Scenario: Review the Today projection
- **WHEN** a user opens Today
- **THEN** the system shows only available open present Anytime work marked Now, Next, or Later and groups it in that order

#### Scenario: Review the Anytime pool
- **WHEN** a user opens Anytime
- **THEN** the system shows every available open present Anytime to-do, including Today members, and marks each Today member with its Now, Next, or Later placement

#### Scenario: Remove work from Today
- **WHEN** a user removes Today membership from a to-do
- **THEN** the system records the `none` section, removes the to-do from Today, and keeps it in Anytime without changing its identity or container

#### Scenario: Defer work to a future date
- **WHEN** a user assigns a future start date to a to-do or project
- **THEN** the system removes Today membership, includes the item in Upcoming, and withholds it from Anytime until its owner-local start date arrives

#### Scenario: Activate deferred work
- **WHEN** an Anytime item reaches its owner-local start date
- **THEN** the system returns it to Anytime without automatically adding it to Today

#### Scenario: Store an uncommitted possibility
- **WHEN** a user assigns a to-do or project to Someday
- **THEN** the system clears its start date and Today membership and withholds it from Today, Upcoming, and Anytime

#### Scenario: Activate Someday work
- **WHEN** a user moves a Someday item to Anytime or assigns it a start date
- **THEN** the system changes its destination to Anytime and includes it in Anytime or Upcoming according to that date without automatically adding it to Today

#### Scenario: Complete, cancel, or delete work
- **WHEN** a user completes, cancels, or deletes a to-do or supported hierarchy root
- **THEN** the system removes it from active planning views and includes it in Done until recovery or automatic purge

### Requirement: Bulk Task Planning
The system SHALL provide an explicit accessible selection mode for open tasks and SHALL apply supported Today membership, future scheduling, Anytime, or Someday actions to selected records as one local transaction.

#### Scenario: Select multiple visible tasks
- **WHEN** a user enters selection in Today, Upcoming, Anytime, or Someday and selects one or more visible tasks
- **THEN** the interface reports the selected count, exposes Select All and Clear, and communicates each selected state to keyboard and assistive-technology users

#### Scenario: Plan selected tasks
- **WHEN** a user applies Today Now, Today Next, Today Later, Remove from Today, Tomorrow, Anytime, or Someday to selected tasks
- **THEN** the system updates every selected task's destination, Today section, start date, mutation metadata, revision, and relevant order in one local transaction while preserving selected order

#### Scenario: Reject one invalid bulk member
- **WHEN** any selected task is no longer open and present or the requested start date conflicts with one selected deadline
- **THEN** the system rejects the operation without writing any selected task and leaves selection available for correction or retry

#### Scenario: Keep bulk scope bounded
- **WHEN** the user exits selection, changes views, or completes a successful bulk plan
- **THEN** the client clears selection and returns to ordinary editing without adding bulk completion, deletion, or hierarchy mutation

### Requirement: Orthogonal Task State
The system SHALL model lifecycle, record disposition, planning destination, Today membership, and structured actionability as separate dimensions with revision-checked transitions and append-only history.

#### Scenario: Complete open work
- **WHEN** a caller completes present open work from the current revision
- **THEN** the system sets lifecycle to completed, records `completed_at`, removes the work from active views, includes it in Done, and appends one completion event

#### Scenario: Cancel open work
- **WHEN** a caller cancels present open work from the current revision
- **THEN** the system sets lifecycle to canceled, records `canceled_at`, removes the work from active views, includes it in Done, and appends one cancellation event

#### Scenario: Delete work
- **WHEN** a caller deletes present work from the current revision
- **THEN** the system records recoverable deletion, includes the root in Done, and preserves the hierarchy operation receipt

#### Scenario: Reopen terminal work
- **WHEN** a caller reopens completed or canceled work from Done during retention
- **THEN** the system returns lifecycle to open, clears the current terminal timestamp, restores valid Anytime placement with no Today membership when needed, and retains prior history

#### Scenario: Restore deleted work
- **WHEN** a caller restores deleted work from Done during retention
- **THEN** the system restores valid prior hierarchy and active state, falling back to Anytime with no Today membership when the prior placement is no longer valid

#### Scenario: Retry a lifecycle transition
- **WHEN** a caller repeats a lifecycle mutation with the same client mutation identifier
- **THEN** the system returns the original receipt without appending another history event

#### Scenario: Cascade a project transition explicitly
- **WHEN** a caller invokes a supported cascade transition for a project and its open descendants
- **THEN** the system applies the transition atomically and reports every affected stable identifier

#### Scenario: Complete a parent to-do with checklist state
- **WHEN** a caller completes and later reopens a to-do with checklist items
- **THEN** the system preserves each checklist item's prior completion state

### Requirement: Recoverable History
The system SHALL provide append-only history, guarded undo, mutation receipts, a recoverable Done queue, versioned export, verified restore, and automatic terminal-data expiry.

#### Scenario: Undo a recent change
- **WHEN** a user invokes undo for a supported recent task mutation
- **THEN** the system restores the prior state and synchronizes the restoration as a new valid mutation

#### Scenario: Reject an unsafe undo
- **WHEN** intervening changes make an inverse mutation unsafe
- **THEN** the system rejects undo without overwriting current data and returns a conflict receipt

#### Scenario: Return a mutation receipt
- **WHEN** the system accepts, rejects, or treats a task mutation as a no-op
- **THEN** it returns a content-free receipt with the client mutation identifier, actor, channel, affected stable identifiers, revisions, transition, timestamp, outcome, and applicable code

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

#### Scenario: Export task data
- **WHEN** a user requests an export
- **THEN** the system produces a versioned checksummed JSON envelope containing active and retained Done data without credentials or delivery tokens

#### Scenario: Read an older export
- **WHEN** a user previews a supported older export containing Inbox, Today, daytime, evening, Logbook, or Trash state
- **THEN** the system deterministically normalizes it to Anytime, Today membership, and Done before reporting inserts, matches, and conflicts

#### Scenario: Replace from a verified backup
- **WHEN** a user confirms replacement from a compatible verified export
- **THEN** the system creates a pre-restore backup, replaces the synchronized task graph atomically, and preserves the authenticated owner boundary

### Requirement: Keyboard-First Daily Operation
The system SHALL provide complete keyboard operation for capture, editing, Today planning, navigation, search, selection, lifecycle transitions, and dialogs without overriding browser tab-number shortcuts.

#### Scenario: Capture from the keyboard
- **WHEN** focus is outside an editable control and the user presses `N`
- **THEN** the interface focuses the current capture field or navigates to Today and focuses capture

#### Scenario: Save from the keyboard
- **WHEN** a task editor is open and the user presses Command+Enter or Control+Enter outside composition
- **THEN** the editor submits the same validated save as the visible action

#### Scenario: Navigate task views
- **WHEN** focus is outside an editable control and the user presses `G` followed by a documented view key
- **THEN** the interface navigates to Today, Upcoming, Anytime, Someday, Projects, Templates, Done, or Config without claiming browser tab-number shortcuts

#### Scenario: Search tasks and views
- **WHEN** focus is outside an editable control and the user presses `/`
- **THEN** a dialog searches owner-scoped tasks and current views and supports keyboard selection without exposing retired Inbox, Logbook, or Trash destinations

#### Scenario: Preserve native editing behavior
- **WHEN** focus is inside an input, textarea, select, content-editable surface, menu, or dialog
- **THEN** task shortcuts do not replace native typing, composition, selection, undo, or control behavior except for the documented form submission shortcut

### Requirement: Concise Tasks Navigation
The system SHALL keep Tasks navigation to five or fewer persistent destinations at every viewport and SHALL place secondary task views behind one More menu.

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

### Requirement: Concise Task View Presentation
The system SHALL use the active view name, compact self-evident controls, progressive disclosure, and small structured Today markers so routine browsing remains uncluttered.

#### Scenario: Name the active view
- **WHEN** any supported Tasks route renders
- **THEN** the primary heading identifies Today, Upcoming, Anytime, Someday, Projects, Project, Area, Templates, Done, or Config at every viewport

#### Scenario: Mark Today membership in Anytime
- **WHEN** an Anytime row also belongs to Today Now, Next, or Later
- **THEN** the row displays compact Lucide iconography with a nonempty accessible name identifying that section without repeating a verbose sentence

#### Scenario: Omit an irrelevant Today marker
- **WHEN** an Anytime row has no Today membership
- **THEN** the row does not reserve empty marker space or show a decorative icon

#### Scenario: Browse Done without archive ceremony
- **WHEN** a user opens Done
- **THEN** the interface shows retained terminal work in reverse terminal order with its terminal reason, date, and one appropriate restore or reopen action

#### Scenario: Create hierarchy progressively
- **WHEN** a user creates an area or project from Projects
- **THEN** compact icon-only controls open title-only keyboard-complete BathOS dialogs and restore trigger focus after close

## ADDED Requirements

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

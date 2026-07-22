## ADDED Requirements

### Requirement: Readable Markdown Task Notes
The system SHALL retain task notes as plain text while presenting complete safe Markdown and a full-height editing surface in an expanded to-do.

#### Scenario: Read complete formatted notes
- **WHEN** an expanded to-do has nonempty notes and notes editing is inactive
- **THEN** the interface renders the complete notes without an internal height limit and styles CommonMark paragraphs, emphasis, strong text, inline code, and asterisk-prefixed lists

#### Scenario: Follow a note link
- **WHEN** notes contain a Markdown link, autolink, or bare HTTP or HTTPS URL
- **THEN** the rendered destination is a real safe link that preserves default browser opening behavior and does not make an unsafe protocol actionable

#### Scenario: Edit complete notes
- **WHEN** a user enters notes editing
- **THEN** the interface shows the original Markdown source in an auto-growing plain-text control whose full content remains visible and whose changes save back to the same notes field

#### Scenario: Start empty notes directly
- **WHEN** an expanded to-do has empty notes
- **THEN** the interface presents the editable notes control with its placeholder without requiring a separate preview step

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

## MODIFIED Requirements

### Requirement: Date-Based Planning Views
The system SHALL derive Today, Upcoming, Anytime, Someday, and Done from task state, owner-local start dates, deadlines, independent day horizons, and terminal timestamps.

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
- **THEN** the system shows eligible open present Anytime work and groups it in Inbox, Now, Next, and Later order without rendering an empty horizon heading

#### Scenario: Review the Anytime pool
- **WHEN** a user opens Anytime
- **THEN** the system shows every open present Anytime item whose start date is absent, today, or earlier and marks its resolved Inbox, Now, Next, or Later placement when it also appears in Today

#### Scenario: Select the Upcoming controlling date
- **WHEN** an open present Anytime item has a future start date
- **THEN** Upcoming uses that start date for membership, ordering, and grouping even when the item also has a different deadline

#### Scenario: Fall back to a future deadline
- **WHEN** an open present Anytime item has no future start date and has a future deadline
- **THEN** Upcoming includes and groups the item by that deadline while the item remains available in Anytime when otherwise eligible

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
- **WHEN** a user opens Upcoming for an item with a future controlling date
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

### Requirement: Concise Task View Presentation
The system SHALL use the active view name, compact self-evident controls, progressive disclosure, semantic Today indicators, and distinct completion and selection shapes so routine browsing remains uncluttered.

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

#### Scenario: Mark Today membership in Anytime
- **WHEN** an Anytime row also belongs to Today in resolved Inbox, Now, Next, or Later placement
- **THEN** the row displays a compact yellow Lucide horizon icon before its title with a nonempty accessible name identifying that placement

#### Scenario: Mark a future day horizon in Upcoming
- **WHEN** an Upcoming row has a selected Inbox, Now, Next, or Later horizon
- **THEN** the row displays the compact Lucide horizon icon before its title with a nonempty accessible name identifying that future placement

#### Scenario: Use neutral horizon iconography
- **WHEN** the interface renders Inbox or Next as a heading or row marker
- **THEN** Inbox uses the Lucide Inbox icon and Next uses a non-arrow list-position icon that does not imply a row action

#### Scenario: Omit an irrelevant day-horizon marker
- **WHEN** an undated Anytime row has no explicit day horizon
- **THEN** the row does not reserve empty marker space or show a decorative icon

#### Scenario: Browse Done without archive ceremony
- **WHEN** a user opens Done
- **THEN** the interface shows retained terminal work in reverse terminal order with its terminal reason, date, and one appropriate restore or reopen action

#### Scenario: Create hierarchy progressively
- **WHEN** a user creates an area or project from Projects
- **THEN** compact icon-only controls open title-only keyboard-complete BathOS dialogs and restore trigger focus after close

## ADDED Requirements

### Requirement: Unified Task Start Picker
The Tasks interface SHALL present a single autosaving Start control for Today horizon, future deferral date, and reminder intent by composing the established BathOS popover and calendar primitives with Tasks-specific controls.

#### Scenario: Open the complete Start picker
- **WHEN** a user activates Start from an open to-do or its action menu
- **THEN** one BathOS popover presents Inbox, Now, Next, and Later Today horizons, a calendar, reminder time, and Clear without separate Start Date, Day Horizon, or Reminder Time editor fields

#### Scenario: Choose a Today horizon
- **WHEN** a user chooses Inbox, Now, Next, or Later in the Start picker
- **THEN** Tasks immediately stores that active Today horizon with a null future Start Date and keeps the picker available for optional reminder editing

#### Scenario: Choose a future Start date
- **WHEN** a user chooses a date after the owner's planning date
- **THEN** Tasks immediately stores that future Start Date, retains a valid selected day horizon for reached-date activation, and keeps the picker available for optional reminder editing

#### Scenario: Prevent calendar scheduling for today or the past
- **WHEN** the Start picker calendar displays the owner planning date or an earlier date
- **THEN** those date buttons are disabled because Today placement is selected through an explicit day horizon

#### Scenario: Add or clear a reminder inside Start
- **WHEN** a task has a Today horizon or future Start Date and the user enters or clears a reminder time
- **THEN** Tasks immediately saves or cancels the one dependent reminder through the authoritative reminder contract without requesting an independent reminder date

#### Scenario: Clear Start
- **WHEN** the user activates Clear in the Start picker
- **THEN** Tasks immediately clears both future Start Date and Today horizon and cancels any active reminder and pending occurrence

#### Scenario: Traverse the complete picker by keyboard
- **WHEN** focus enters the Start picker
- **THEN** Tab and Shift+Tab traverse its horizon, calendar, reminder, and clear controls, arrow keys navigate the shared calendar, Escape closes the popover, and close restores focus to the trigger

#### Scenario: Open Start from the reminder command
- **WHEN** Command+E on Mac or Control+E on Windows targets one open to-do or one or more selected to-dos
- **THEN** Tasks opens the Start surface for an eligible single target with reminder time prefocused, or opens the existing multi-task reminder surface for eligible bulk work, and suppresses the matching browser command

#### Scenario: Withhold a reminder from unplanned work
- **WHEN** a task has neither a Today horizon nor a future Start Date
- **THEN** the reminder time control remains visible for discovery but disabled until the user chooses a Start intent

### Requirement: Focused To-Do Action Menu
The Tasks interface SHALL keep the to-do ellipsis menu limited to actionability, structural Move, temporal Do, Start planning, and recoverable Delete while retaining drag and keyboard ordering outside that menu.

#### Scenario: Present planning actions by intent
- **WHEN** a user opens an active to-do's ellipsis menu
- **THEN** the menu exposes Move for area or project placement, Do for Today, Anytime, and Someday placement, and Start for the unified Start picker

#### Scenario: Omit redundant terminal action
- **WHEN** a user opens an active to-do's ellipsis menu
- **THEN** the menu exposes Delete and does not expose Cancel

#### Scenario: Omit menu ordering commands
- **WHEN** a user opens an active to-do's ellipsis menu
- **THEN** the menu does not expose Move Up or Move Down while drag and Option or Alt arrow ordering remain available in supported views

### Requirement: Explicit Primary Link Clearing
The system SHALL preserve an explicitly cleared Primary Link independently from immutable typed source provenance.

#### Scenario: Reopen a cleared Mail Primary Link
- **WHEN** a user clears a Mail-captured to-do's Primary Link, closes the editor, and later reopens it
- **THEN** the Primary Link remains null, the row exposes no Primary Link icon, and the immutable Mail source remains unchanged

#### Scenario: Restore explicit null without legacy fallback
- **WHEN** a current export envelope contains a `primary_link` key whose value is null
- **THEN** restore preserves null and does not initialize the shortcut from `source_url`

#### Scenario: Initialize a missing legacy Primary Link
- **WHEN** an older export envelope omits the `primary_link` key for supported Mail provenance
- **THEN** normalization MAY initialize the editable shortcut from the verified Mail source for backward compatibility

## MODIFIED Requirements

### Requirement: Orthogonal Task State
The system SHALL model lifecycle, record disposition, planning destination, Today membership, and structured actionability as separate dimensions with revision-checked transitions and append-only history.

#### Scenario: Complete open work
- **WHEN** a caller completes present open work from the current revision
- **THEN** the system sets lifecycle to completed, records `completed_at`, removes the work from active views, includes it in Done, and appends one completion event

#### Scenario: Cancel open work
- **WHEN** a non-web caller cancels present open work from the current revision
- **THEN** the system sets lifecycle to canceled, records `canceled_at`, removes the work from active views, includes it in Done, and appends one cancellation event

#### Scenario: Omit cancellation from active to-do web actions
- **WHEN** the web interface presents lifecycle actions for an active to-do
- **THEN** it offers completion and recoverable deletion without exposing cancellation as a third terminal path

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
The system SHALL store Start Date as a future-only deferral calendar fact, store Deadline independently, retain day horizons for active Today work, derive activation and Today from the owner's IANA planning time zone, and store reminder times as unambiguous instants resolved on the current Start intent.

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
- **THEN** local and server activation converge on a null start date, retained day horizon, one accepted revision transition, defensive Today visibility while synchronization catches up, and preservation of an already-resolved same-day reminder

#### Scenario: Place work in a day horizon
- **WHEN** a user selects Inbox, Now, Next, or Later for Anytime work
- **THEN** the system records the active horizon without inventing a future Start Date

#### Scenario: Edit Start and dependent controls
- **WHEN** a user opens a to-do's temporal planning controls
- **THEN** one Start picker presents Today horizons, a future-only calendar, reminder time, and Clear with complete keyboard operation and immediate persistence

#### Scenario: Resolve a reminder
- **WHEN** a caller schedules a reminder with a wall-clock time and IANA time zone for an item with a future Start Date or Today horizon
- **THEN** the system stores that time intent and resulting UTC instant on the future Start Date or owner planning date for every delivery client

#### Scenario: Resolve a nonexistent reminder time
- **WHEN** a requested local reminder time falls in a daylight-saving gap on its effective reminder date
- **THEN** the system selects the first valid instant after the gap and records the adjustment

#### Scenario: Resolve an ambiguous reminder time
- **WHEN** a requested local reminder time occurs twice during a daylight-saving transition and the caller supplies no preference
- **THEN** the system selects the earlier instant and records that choice

#### Scenario: Display a reminder after travel
- **WHEN** the owner's display time zone changes after a reminder is resolved
- **THEN** the interface converts the stored instant for display without moving the scheduled instant

### Requirement: Stable Manual Ordering
The system SHALL preserve intentional manual ordering across direct drag, keyboard moves, same-view Today horizon changes, saves, refreshes, offline operation, and synchronization.

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
- **THEN** the interface retains keyboard commands that move the focused task within the same supported scope

#### Scenario: Reorder within a Today horizon by keyboard
- **WHEN** a user invokes a keyboard reorder in Inbox, Now, Next, or Later
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

### Requirement: Deferral-Anchored Reminder Time
The system SHALL allow at most one active reminder per to-do or project, SHALL derive its calendar date from the item's future Start Date or owner-local planning date for a Today horizon, and SHALL expose only its local time as user-editable reminder intent.

#### Scenario: Add a reminder to scheduled work
- **WHEN** a user assigns a reminder time to an open item with a future Start Date
- **THEN** the system resolves one reminder on that Start Date in the owner's planning time zone and does not request or store an independently chosen reminder date

#### Scenario: Add a reminder to Today work
- **WHEN** a user assigns a reminder time to an open item with a Today horizon and no future Start Date
- **THEN** the system resolves one reminder on the owner's current planning date and does not request or store an independently chosen reminder date

#### Scenario: Withhold reminders from unplanned work
- **WHEN** an open item has neither a future Start Date nor a Today horizon
- **THEN** the interface disables reminder entry and every mutation surface rejects a new reminder for that item

#### Scenario: Clear all Start intent with a reminder
- **WHEN** a user clears both future Start Date and Today horizon from an item that has an active reminder
- **THEN** the system cancels its reminder and pending occurrence

#### Scenario: Move future work directly to Today
- **WHEN** a user replaces a future Start Date with a Today horizon while retaining its reminder time
- **THEN** the system re-resolves the reminder on the owner planning date and replaces the prior pending occurrence exactly once

#### Scenario: Activate work without losing its same-day reminder
- **WHEN** the owner-local Start Date arrives before the item's resolved reminder time
- **THEN** activation clears the parent Start Date, retains its day horizon, and preserves the already-scheduled occurrence so it remains deliverable that day

#### Scenario: Move the Start Date with a reminder
- **WHEN** a user changes an item's future Start Date while retaining its reminder time
- **THEN** the system re-resolves the reminder against the new date and replaces the prior pending occurrence exactly once

#### Scenario: Normalize existing reminder data
- **WHEN** the effective-date reminder migration encounters an active reminder
- **THEN** it rebinds that reminder to its parent's future Start Date or current Today planning date and cancels it only when the parent has neither Start form

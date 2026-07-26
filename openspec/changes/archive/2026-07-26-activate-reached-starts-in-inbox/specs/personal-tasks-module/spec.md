## MODIFIED Requirements

### Requirement: Date-Based Planning Views
The system SHALL derive Today, Upcoming, Anytime, Someday, and Done from task state, owner-local future Starts, mutually exclusive Today horizons, deadlines, and terminal timestamps.

#### Scenario: Defer work to a future date
- **WHEN** a user assigns a future start date to a to-do or project
- **THEN** the system includes the item in Upcoming, withholds it from Today and Anytime until its owner-local start date arrives, and stores no Today horizon

#### Scenario: Store an uncommitted possibility
- **WHEN** a user assigns a to-do or project to Someday
- **THEN** the system clears its start date, day horizon, and reminder and withholds it from Today, Upcoming, and Anytime

#### Scenario: Activate Someday work
- **WHEN** a user moves a Someday item to Anytime without a start date
- **THEN** the system changes its destination to Anytime, includes it in Anytime, and retains a null day horizon

#### Scenario: Schedule Someday work
- **WHEN** a user assigns a future Start to Someday work
- **THEN** the system changes its destination to Anytime, includes it in Upcoming according to that date, and stores no Today horizon

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

#### Scenario: Keep future work outside Today horizons
- **WHEN** a user opens Upcoming for an item with a future Start
- **THEN** the interface presents the Start without an Inbox, Now, Next, or Later horizon

#### Scenario: Remove work from Today
- **WHEN** a user removes Today placement from a to-do
- **THEN** the system clears its day horizon, removes the to-do from Today, and keeps it undated in Anytime without changing its identity or container

#### Scenario: Activate deferred work
- **WHEN** an Anytime task reaches its owner-local start date through ordinary temporal activation
- **THEN** an idempotent activation clears its start date, assigns Today Inbox, and includes it in Anytime and Today

#### Scenario: Complete, cancel, or delete work
- **WHEN** a user completes, cancels, or deletes a to-do or supported hierarchy root
- **THEN** the system removes it from active planning views and includes it in Done until recovery or automatic purge

### Requirement: Deferral-Anchored Reminder Time
The system SHALL allow at most one active reminder per to-do or project, SHALL derive its calendar date from the item's future Start Date or owner-local planning date for a Today horizon, and SHALL expose only its local time as user-editable reminder intent.

#### Scenario: Add a reminder to scheduled work
- **WHEN** a user assigns a reminder time to an open item with a future Start Date
- **THEN** the system resolves one reminder on that Start Date in the owner's planning time zone and does not request or store an independently chosen reminder date

#### Scenario: Add a reminder to Today work
- **WHEN** a user assigns a reminder time to an open item with a Today horizon and no future Start Date
- **THEN** the system resolves one reminder on the owner's current planning date and does not request or store an independently chosen reminder date

#### Scenario: Default reminder planning for unplanned work
- **WHEN** an open to-do has neither a future Start Date nor a Today horizon and the user saves a valid reminder time
- **THEN** the system first assigns Today · Inbox and then resolves the reminder on the owner's current planning date

#### Scenario: Clear all Start intent with a reminder
- **WHEN** a user clears both future Start Date and Today horizon from an item that has an active reminder
- **THEN** the system cancels its reminder and pending occurrence

#### Scenario: Move future work directly to Today
- **WHEN** a user replaces a future Start Date with a Today horizon while retaining its reminder time
- **THEN** the system re-resolves the reminder on the owner planning date and replaces the prior pending occurrence exactly once

#### Scenario: Activate work without losing its same-day reminder
- **WHEN** the owner-local Start Date arrives before a task's resolved reminder time
- **THEN** activation clears the parent Start Date, assigns Today Inbox, and preserves the already-scheduled occurrence so it remains deliverable that day

#### Scenario: Move the Start Date with a reminder
- **WHEN** a user changes an item's future Start Date while retaining its reminder time
- **THEN** the system re-resolves the reminder against the new date and replaces the prior pending occurrence exactly once

#### Scenario: Normalize existing reminder data
- **WHEN** the effective-date reminder migration encounters an active reminder
- **THEN** it rebinds that reminder to its parent's future Start Date or current Today planning date and cancels it only when the parent has neither Start form

### Requirement: Temporal Planning Semantics
The system SHALL store Start Date as a future-only deferral calendar fact, store Deadline independently, retain day horizons for active Today work, reset unfinished Today tasks for owner-local daily re-planning, derive activation and Today from the owner's IANA planning time zone, and store reminder times as unambiguous instants resolved on the current Start intent.

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
- **THEN** local and server activation converge on a null start date, Today Inbox, one accepted revision transition, defensive Today visibility while synchronization catches up, and preservation of an already-resolved same-day reminder

#### Scenario: Reset unfinished Today tasks after midnight
- **WHEN** the owner's planning date advances while one or more open, present tasks remain in Inbox, Now, Next, or Later
- **THEN** local and server activation converge on Today Inbox for every such task with one accepted system-authored revision transition per task

#### Scenario: Activate newly reached Starts after rollover
- **WHEN** the owner-local planning date advances while prior-day Today tasks and future Starts reaching the new date both exist
- **THEN** the system resets the prior-day Today tasks to Inbox before activating the newly reached Starts into Today Inbox

#### Scenario: Preserve deliberate planning after midnight
- **WHEN** a task is created or its Today planning is changed after the new owner-local date begins but before the next automatic rollover check
- **THEN** the rollover retains that new-day horizon because the task has already been deliberately planned for the current date

#### Scenario: Exclude inactive and deferred work from rollover
- **WHEN** the owner-local planning date advances
- **THEN** completed, canceled, deleted, Someday, future-starting, and horizon-free Anytime tasks retain their existing planning and lifecycle state

#### Scenario: Preserve reminders through daily rollover
- **WHEN** an unfinished Today task with a reminder rolls into the new day's Inbox
- **THEN** the reminder retains its original local date, resolved instant, occurrence, and delivery state rather than being repeated or rescheduled

#### Scenario: Retry or catch up daily rollover
- **WHEN** repeated clients or jobs evaluate the same planning date, or evaluation resumes after one or more missed days
- **THEN** the system performs at most one effective rollover for the latest owner-local date and does not append no-op task revisions

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

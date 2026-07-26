## MODIFIED Requirements

### Requirement: Temporal Planning Semantics
The system SHALL store Start Date as a future-only deferral calendar fact, store Deadline independently, retain day horizons for active Today work, reset unfinished Today tasks for owner-local daily re-planning, derive activation and Today from the owner's IANA planning time zone, and store reminder times as unambiguous instants resolved on the current Start intent.

#### Scenario: Start date and deadline coexist in either order
- **WHEN** a task has both a start date and a deadline
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
- **THEN** local and server activation converge on a null start date, Today Next, one accepted revision transition, defensive Today visibility while synchronization catches up, and preservation of an already-resolved same-day reminder

#### Scenario: Reset unfinished Today tasks after midnight
- **WHEN** the owner's planning date advances while one or more open, present tasks remain in Inbox, Now, Next, or Later
- **THEN** local and server activation converge on Today Inbox for every such task with one accepted system-authored revision transition per task

#### Scenario: Activate newly reached Starts after rollover
- **WHEN** the owner-local planning date advances while prior-day Today tasks and future Starts reaching the new date both exist
- **THEN** the system resets the prior-day Today tasks to Inbox before activating the newly reached Starts into Today Next

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
- **WHEN** a user opens a task's temporal planning controls
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

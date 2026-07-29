## MODIFIED Requirements

### Requirement: Recurrence Integrity
The system SHALL keep revisioned recurrence definitions separate from task occurrences, SHALL support calendar and after-completion schedules, and SHALL assign every logical recurrence event a deterministic unique identity.

#### Scenario: Apply Repeat to an existing task
- **WHEN** a user saves a recurrence on an ordinary task
- **THEN** the system snapshots that task as the recurrence template, adopts the existing task as the first occurrence without duplication, and records recurrence provenance

#### Scenario: Configure an after-completion recurrence
- **WHEN** a user chooses after completion and supplies a positive interval in days, weeks, months, or years
- **THEN** the recurrence waits for authoritative completion of the current occurrence before deriving the next schedule anchor

#### Scenario: Configure a calendar recurrence
- **WHEN** a user chooses daily, weekly, monthly, or yearly recurrence and supplies its interval and applicable day pattern
- **THEN** the editor previews the next bounded dates and the authoritative rule produces the same logical dates

#### Scenario: Configure recurrence end
- **WHEN** a user chooses never, after a positive number of occurrences, or on an inclusive end date
- **THEN** the recurrence produces no occurrence beyond that boundary

#### Scenario: Generate a recurring occurrence
- **WHEN** an active recurrence definition becomes due to produce work
- **THEN** the authoritative server transaction creates no more than one occurrence for that logical recurrence event

#### Scenario: Derive Start from a repeating Deadline
- **WHEN** a recurrence includes deadlines and specifies that work starts a nonnegative number of days earlier
- **THEN** each schedule date becomes the task Deadline and the generated task Start is that many owner-local dates earlier

#### Scenario: Inherit a recurrence reminder
- **WHEN** a recurrence enables a valid reminder time
- **THEN** each generated occurrence receives that reminder on its generated Start date through the existing time-zone-safe reminder path

#### Scenario: Complete an occurrence
- **WHEN** a user completes one occurrence of after-completion work
- **THEN** the system preserves the recurrence definition and evaluates exactly one next event from the authoritative completion

#### Scenario: Present waiting after-completion work
- **WHEN** an active after-completion recurrence has an outstanding occurrence that is not already represented in a dated Upcoming bucket and therefore cannot yet derive its successor
- **THEN** Upcoming presents the recurrence once in a non-draggable Repeating Tasks section after its dated buckets, with Waiting in second-row metadata

#### Scenario: Go to the outstanding instance
- **WHEN** a user chooses Go to Instance for a waiting after-completion recurrence
- **THEN** Tasks navigates to the list containing its outstanding instance and opens that task

#### Scenario: Present calendar occurrences
- **WHEN** calendar recurrence evaluation generates future tasks
- **THEN** Upcoming presents each task in the one date bucket determined by its Start when present or otherwise its Deadline

#### Scenario: Distinguish an Upcoming recurrence projection
- **WHEN** a generated recurrence occurrence appears in an Upcoming date bucket
- **THEN** its leading control is the recurrence symbol rather than a checkbox and it cannot be completed, bulk-mutated, dragged, or directly assigned a different Start

#### Scenario: Reach a recurrence task instance
- **WHEN** a generated occurrence reaches its Start and appears in Today or Anytime
- **THEN** it behaves as an ordinary task instance and does not expose Edit Repeat

#### Scenario: Edit Repeat from Upcoming
- **WHEN** a user activates a recurrence projection or chooses Edit Repeat
- **THEN** Tasks opens the recurrence editor with the current revision values and saves accepted changes as a new recurrence revision

#### Scenario: Replace materialized future projections after a calendar edit
- **WHEN** a calendar recurrence edit is accepted after its prior revision has materialized future Upcoming projections
- **THEN** the system supersedes those prior-revision future projections, resets evaluation to the owner-local planning date, and materializes the edited cadence without changing any reached task instance

#### Scenario: Override the next after-completion occurrence
- **WHEN** a user edits a waiting after-completion recurrence and changes Next Occurrence
- **THEN** completion of its outstanding older-revision instance generates the next occurrence on that date and later completions resume interval-based scheduling

#### Scenario: Cancel an after-completion occurrence
- **WHEN** a user cancels an occurrence governed by an after-completion rule
- **THEN** the system does not advance that rule from the cancellation

#### Scenario: Retry occurrence generation
- **WHEN** clients or jobs concurrently request generation for the same logical recurrence event
- **THEN** a uniqueness boundary returns the one existing occurrence instead of creating a duplicate

#### Scenario: Continue calendar evaluation from its durable cursor
- **WHEN** a calendar recurrence has already been evaluated through an earlier date and a new request evaluates it farther forward
- **THEN** the server derives the first unevaluated and latest due logical steps directly, bounds catch-up work independently from the recurrence age, and does not rescan from the original Start

#### Scenario: Evaluate missed calendar events
- **WHEN** a calendar recurrence has one or more missed events
- **THEN** the generator applies the definition's explicit `skip`, `latest`, or `all` policy and defaults to `latest`

#### Scenario: Edit a recurrence definition
- **WHEN** a user changes a recurrence definition after it has generated work
- **THEN** the change creates a new revision, reached occurrences retain their source revision, and superseded future schedule projections remain durable but are omitted from task surfaces

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

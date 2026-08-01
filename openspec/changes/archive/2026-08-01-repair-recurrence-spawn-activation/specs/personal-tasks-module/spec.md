## MODIFIED Requirements

### Requirement: Recurrence Integrity
The system SHALL keep revisioned recurrence definitions separate from task instances, SHALL present one permanent recurrence prototype only in Upcoming while the definition remains active and has a knowable next spawn date, SHALL support calendar and after-completion schedules, SHALL assign every logical recurrence event a deterministic unique identity, and SHALL generate due instances through owner-local background activation without requiring an open client.

#### Scenario: Apply Repeat to an existing task
- **WHEN** a user saves a recurrence on an ordinary task
- **THEN** the system snapshots that task as the recurrence template, uses it as the initial recurrence prototype without duplicating a spawned instance before its first spawn date, and records recurrence provenance

#### Scenario: Configure an after-completion recurrence
- **WHEN** a user chooses after completion and supplies a positive interval in days, weeks, months, or years
- **THEN** the recurrence waits for an authoritative Done transition of the current instance before deriving the next schedule anchor

#### Scenario: Configure a calendar recurrence
- **WHEN** a user chooses daily, weekly, monthly, or yearly recurrence and supplies its interval and applicable day pattern
- **THEN** the editor previews the next bounded dates and the authoritative rule produces the same logical dates

#### Scenario: Configure recurrence end
- **WHEN** a user chooses never, after a positive number of occurrences, or on an inclusive end date
- **THEN** the recurrence produces no occurrence beyond that boundary

#### Scenario: Generate a recurring instance
- **WHEN** an active recurrence prototype reaches its spawn date in the owner's planning time zone
- **THEN** the authoritative server activation creates no more than one ordinary task instance for that logical recurrence event and advances the prototype to its next knowable spawn date without requiring a foreground client

#### Scenario: Inherit prototype metadata
- **WHEN** a recurrence prototype spawns a task instance
- **THEN** the instance inherits the prototype's captured summary, notes, Primary Link, Area, checklist content and completion states, actionability, reminder configuration, and applicable Start and Deadline rules

#### Scenario: Derive Start from a repeating Deadline
- **WHEN** a recurrence includes deadlines and specifies that work starts a nonnegative number of days earlier
- **THEN** each cadence date becomes the task Deadline, the spawn date is that many owner-local dates earlier, and the generated task persists that spawn date as its Start

#### Scenario: Activate an early-Start recurrence at midnight
- **WHEN** owner-local midnight makes a calendar recurrence's spawn date current while its cadence Deadline remains in the future
- **THEN** background activation creates the ordinary instance in Today Inbox with the current Start and future Deadline and advances the prototype to its next cadence bucket

#### Scenario: Inherit a recurrence reminder
- **WHEN** a recurrence enables a valid reminder time
- **THEN** each generated instance receives that reminder on its generated Start date through the existing time-zone-safe reminder path

#### Scenario: Complete an after-completion instance
- **WHEN** a user completes the latest instance of after-completion work
- **THEN** the system preserves the recurrence definition and derives exactly one next prototype date from the authoritative completion date

#### Scenario: Trash an after-completion instance
- **WHEN** a user trashes the latest instance of after-completion work
- **THEN** the system treats the authoritative trash date as its Done date and derives exactly one next prototype date from it

#### Scenario: Present waiting after-completion work
- **WHEN** an active after-completion recurrence has an outstanding open instance and therefore cannot yet derive its successor
- **THEN** Upcoming presents the prototype once in a non-draggable Repeating Tasks section after its dated buckets, with Waiting in second-row metadata

#### Scenario: Restore the outstanding after-completion instance
- **WHEN** the latest completed or trashed instance is restored before its successor reaches its spawn date
- **THEN** the system retracts that future successor from task surfaces and returns the prototype to the waiting section until the restored instance enters Done again

#### Scenario: Go to the outstanding instance
- **WHEN** a user chooses Go to Instance for a waiting after-completion prototype
- **THEN** Tasks navigates to the list containing its outstanding instance and opens that ordinary task

#### Scenario: Present a dated recurrence prototype
- **WHEN** an active recurrence has a knowable future spawn date
- **THEN** Upcoming presents exactly one prototype in the date bucket determined by its future Start when present or otherwise its future Deadline

#### Scenario: Exclude a reached prototype from Upcoming
- **WHEN** a recurrence prototype's spawn date is on or before the owner's planning date
- **THEN** Upcoming does not present that prototype in a current-day or past date bucket after activation commits

#### Scenario: Distinguish an Upcoming recurrence prototype
- **WHEN** a future recurrence prototype appears in an Upcoming date bucket
- **THEN** its leading control is the recurrence symbol rather than a checkbox and it cannot be completed, bulk-mutated, dragged, or directly assigned different task metadata

#### Scenario: Present a spawned instance in Upcoming
- **WHEN** an already-spawned recurrence instance remains or becomes eligible for Upcoming because of its editable Start or Deadline
- **THEN** it appears as an ordinary task with a checkbox and complete ordinary task editing, selection, completion, deletion, and drag behavior

#### Scenario: Reach a recurrence task instance
- **WHEN** a future prototype reaches its spawn date and its task instance appears in Today, Anytime, or Upcoming
- **THEN** the instance behaves as an ordinary task and does not expose Edit Repeat

#### Scenario: Keep the prototype after spawning
- **WHEN** a calendar prototype spawns its due instance
- **THEN** the prototype remains represented in Upcoming at the next valid cadence date without causing the spawned instance to appear as repeating

#### Scenario: Edit Repeat from Upcoming
- **WHEN** a user activates a recurrence prototype or chooses Edit Repeat
- **THEN** Tasks opens the recurrence editor with the current prototype name and revision schedule values and saves accepted name or schedule changes as a new recurrence revision

#### Scenario: Keep the next occurrence current or future
- **WHEN** a user creates or edits recurrence scheduling
- **THEN** the next occurrence cannot be selected or saved before the owner's current planning date, and an older source date advances to the next valid cadence date

#### Scenario: Replace materialized future projections after a calendar edit
- **WHEN** a calendar recurrence edit is accepted after its prior revision has materialized a future Upcoming prototype
- **THEN** the system supersedes that prior-revision prototype, resets evaluation to the owner-local planning date, and materializes the edited cadence without changing any reached task instance

#### Scenario: Override the next after-completion occurrence
- **WHEN** a user edits a waiting after-completion recurrence and changes Next Occurrence
- **THEN** the next prototype generated after its outstanding older-revision instance enters Done uses that date and later Done transitions resume interval-based scheduling

#### Scenario: Cancel an after-completion instance
- **WHEN** a user cancels an instance governed by an after-completion rule
- **THEN** the system does not advance that rule from the cancellation

#### Scenario: Retry occurrence generation
- **WHEN** clients or jobs concurrently request generation for the same logical recurrence event
- **THEN** a uniqueness boundary returns the one existing occurrence instead of creating a duplicate

#### Scenario: Continue calendar evaluation from its durable cursor
- **WHEN** a calendar recurrence has already been evaluated through an earlier date and a new request evaluates it farther forward
- **THEN** the server derives due work and the next future prototype from its durable occurrence history without duplicating earlier logical events

#### Scenario: Evaluate missed calendar events
- **WHEN** a calendar recurrence has one or more missed spawn dates
- **THEN** the generator applies the definition's explicit `skip`, `latest`, or `all` policy to spawned instances and defaults to `latest`

#### Scenario: Edit a recurrence definition
- **WHEN** a user changes a recurrence definition after it has generated work
- **THEN** the change creates a new revision, reached instances retain their source revision, and superseded future prototypes remain durable but are omitted from task surfaces

#### Scenario: Pause recurrence
- **WHEN** a user pauses or archives a recurrence definition
- **THEN** the system stops future generation without deleting existing instances

#### Scenario: Report a failed catch-up independently from an accepted definition change
- **WHEN** a recurrence definition is created, revised, or resumed successfully but its immediate occurrence evaluation fails
- **THEN** the system retains the accepted definition change, reports catch-up as a separate content-free failure, avoids an automatic retry loop for the same planning date, and exposes an explicit retry action

#### Scenario: Distinguish unavailable recurrence data from an empty list
- **WHEN** the recurrence projection is loading or fails to load
- **THEN** the web interface presents the corresponding loading or failure state, withholds the empty-list claim, and disables recurrence mutation until the projection is trustworthy

#### Scenario: Hydrate an owner-safe recurrence response
- **WHEN** an authenticated recurrence RPC omits the owner identifier from its returned definition or revision
- **THEN** the client assigns the already authenticated owner to the parsed result while synchronized recurrence rows continue to validate their stored owner identifier

### Requirement: Recurrence Spawn Boundary
Tasks SHALL materialize an ordinary recurrence instance only when its computed spawn date has reached the owner's current planning date, SHALL keep the cadence date as the durable recurrence cursor and generated Deadline where applicable, and SHALL keep unreached work solely as a virtual Upcoming prototype.

#### Scenario: Convert a task before its first spawn date
- **WHEN** a user applies Repeat to an ordinary task with a first spawn date later than the owner's current planning date
- **THEN** the system preserves the task's editable content in the recurrence prototype, removes the ordinary source task from task lists, and presents no ordinary occurrence before that date

#### Scenario: Convert a task on its first spawn date
- **WHEN** a user applies Repeat to an ordinary task whose first spawn date is the owner's current planning date
- **THEN** the system adopts that task as the reached initial ordinary instance and advances the virtual prototype according to its cadence

#### Scenario: Evaluate through the planning date
- **WHEN** an authenticated client or background activation evaluates recurrence through the owner's current planning date
- **THEN** the evaluator generates every occurrence selected by missed policy whose computed spawn date has reached that planning date

#### Scenario: Reject future recurrence evaluation
- **WHEN** any client asks the authoritative recurrence evaluator to generate through a date later than the owner's current planning date
- **THEN** the evaluator rejects the request without creating an occurrence or advancing the prototype

#### Scenario: Repair an unreached adopted projection
- **WHEN** migration data contains an open adopted occurrence whose immutable spawn date is later than the owner's current planning date
- **THEN** the system preserves its current task and checklist content in the prototype, removes the premature task and occurrence, and rewinds the prototype to its cadence date

#### Scenario: Preserve a reached instance deferred into the future
- **WHEN** an ordinary recurrence instance has an immutable spawn date on or before the owner's planning date and the user later assigns it a future Start
- **THEN** recurrence cleanup preserves that ordinary instance and its editable metadata

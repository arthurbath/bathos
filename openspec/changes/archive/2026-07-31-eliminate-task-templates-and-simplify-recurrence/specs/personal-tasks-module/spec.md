## ADDED Requirements

### Requirement: Template-Free Tasks Surface
Tasks SHALL expose no reusable Template entity, view, route, navigation action, creation command, synchronized collection, or current portability collection.

#### Scenario: Open Tasks after template removal
- **WHEN** a user opens any Tasks surface after the template-free release
- **THEN** Tasks presents no Templates navigation item, Templates view, template action, or template-backed recurrence representation

#### Scenario: Open the retired Templates route
- **WHEN** a browser opens `/tasks/templates`
- **THEN** Tasks replace-navigates to `/tasks/upcoming` without rendering a Templates view or falling through to another module

#### Scenario: Remove existing standalone templates
- **WHEN** the approved production migration runs after its exact preflight succeeds
- **THEN** it deletes all standalone template definitions, revisions, instantiations, and private template context without generating tasks from them

#### Scenario: Omit templates from synchronization
- **WHEN** the template-free client synchronizes Tasks
- **THEN** no template collection appears in the PowerSync schema, publication, or owner-scoped stream

## MODIFIED Requirements

### Requirement: Recurrence Integrity
The system SHALL represent each repeating to-do as a first-class revisioned recurrence prototype that lives only in Upcoming, SHALL generate ordinary task instances from that prototype, SHALL support calendar and after-completion schedules, and SHALL assign every spawned logical event a deterministic unique identity.

#### Scenario: Apply Repeat to an existing task
- **WHEN** a user saves a recurrence on an ordinary task
- **THEN** the system snapshots that task into the first recurrence prototype revision, adopts the existing task as the first ordinary occurrence without duplication, and records recurrence lineage

#### Scenario: Keep prototype content authoritative
- **WHEN** a recurrence prototype contains Summary, Notes, Primary Link, Area, Actionability, planning defaults, or checklist items with order and completion state
- **THEN** every future instance is spawned from that immutable prototype revision and no previous instance contributes content to the prototype or a later instance

#### Scenario: Edit an ordinary spawned instance
- **WHEN** a user edits, defers, reorders, completes, trashes, restores, or changes checklist state on a spawned instance
- **THEN** the instance behaves as an ordinary task and the change does not alter prototype content or any later instance

#### Scenario: Configure an after-completion recurrence
- **WHEN** a user chooses after completion and supplies a positive interval in days, weeks, months, or years
- **THEN** the recurrence waits for authoritative completion or trash of the current ordinary instance before deriving the next spawn date

#### Scenario: Configure a calendar recurrence
- **WHEN** a user chooses daily, weekly, monthly, or yearly recurrence and supplies its interval and applicable day pattern
- **THEN** the editor previews the next bounded dates and the authoritative rule produces the same logical dates

#### Scenario: Configure recurrence end
- **WHEN** a user chooses never, after a positive number of occurrences, or on an inclusive end date
- **THEN** the recurrence produces no instance or prototype projection beyond that boundary

#### Scenario: Generate a recurring instance
- **WHEN** an active recurrence prototype reaches a logical spawn date
- **THEN** the authoritative server transaction creates no more than one ordinary task instance for that logical event and advances the prototype independently

#### Scenario: Project the next calendar prototype
- **WHEN** a calendar recurrence has a next logical spawn date after evaluation
- **THEN** Upcoming presents one virtual prototype row in that date bucket without creating a future task row or occurrence row

#### Scenario: Derive Start from a repeating Deadline
- **WHEN** a recurrence includes deadlines and specifies that work starts a nonnegative number of days earlier
- **THEN** each schedule date becomes the ordinary instance Deadline and its Start is that many owner-local dates earlier

#### Scenario: Inherit a recurrence reminder
- **WHEN** a recurrence enables a valid reminder time
- **THEN** each spawned instance receives that reminder on its generated Start date through the existing time-zone-safe reminder path

#### Scenario: Present waiting after-completion work
- **WHEN** an active after-completion recurrence has an outstanding ordinary instance and therefore cannot yet derive its successor
- **THEN** Upcoming presents the prototype once in a non-draggable Repeating Tasks section after its dated buckets with Waiting in second-row metadata

#### Scenario: Go to the outstanding instance
- **WHEN** a user chooses Go to Instance for a waiting after-completion prototype
- **THEN** Tasks navigates to the list containing its outstanding ordinary instance and opens that task

#### Scenario: Complete or trash an after-completion instance
- **WHEN** the outstanding ordinary instance is completed or trashed
- **THEN** the prototype derives exactly one next spawn date from that terminal owner-local date and leaves the terminal instance unchanged in Done

#### Scenario: Restore an after-completion instance
- **WHEN** the outstanding instance is restored before its successor reaches its spawn date
- **THEN** the unspawned successor projection is canceled and the prototype returns to Waiting on that restored instance

#### Scenario: Preserve an already spawned successor on restoration
- **WHEN** an older instance is restored after its successor has already spawned
- **THEN** the system preserves both ordinary instances and does not merge, delete, or rewrite either one

#### Scenario: Distinguish an Upcoming recurrence prototype
- **WHEN** a virtual recurrence prototype appears in an Upcoming date bucket
- **THEN** its leading control is the recurrence symbol rather than a checkbox and it cannot be completed, bulk-mutated, dragged, or directly assigned a different Start

#### Scenario: Present a deferred spawned instance in Upcoming
- **WHEN** a reached ordinary instance is assigned a future Start
- **THEN** Upcoming presents that task in its Start-date bucket with an ordinary checkbox and full ordinary task editing while the prototype remains independently projected at its own next spawn date or waiting section

#### Scenario: Edit Repeat from Upcoming
- **WHEN** a user activates a recurrence prototype or chooses Edit Repeat
- **THEN** Tasks opens the recurrence editor with the current prototype content and schedule and saves accepted changes together as a new immutable recurrence revision

#### Scenario: Keep the next prototype current or future
- **WHEN** a user creates or edits recurrence scheduling
- **THEN** the next prototype date cannot be saved before the owner's current planning date and an older source date advances to the next valid cadence date

#### Scenario: Edit a recurrence cadence without changing reached instances
- **WHEN** a recurrence edit is accepted after the prior revision has spawned ordinary instances
- **THEN** the system creates a new prototype revision, recalculates the unspawned projection, and leaves every reached instance unchanged

#### Scenario: Override the next after-completion occurrence
- **WHEN** a user edits a waiting after-completion prototype and changes Next Occurrence
- **THEN** terminal disposition of its outstanding older-revision instance projects the next spawn on that date and later terminal events resume interval-based scheduling

#### Scenario: Retry instance generation
- **WHEN** clients or jobs concurrently request generation for the same logical recurrence event
- **THEN** a uniqueness boundary returns the one existing occurrence instead of creating a duplicate task

#### Scenario: Continue calendar evaluation from its durable cursor
- **WHEN** a calendar recurrence has already been evaluated through an earlier date and a new request evaluates it farther forward
- **THEN** the server derives due logical steps and the next future prototype directly, bounds catch-up work independently from recurrence age, and does not rescan from the original Start

#### Scenario: Evaluate missed calendar events
- **WHEN** a calendar recurrence has one or more missed events
- **THEN** the generator applies the definition's explicit `skip`, `latest`, or `all` policy and defaults to `latest`

#### Scenario: Pause recurrence
- **WHEN** a user pauses or archives a recurrence definition
- **THEN** the system stops future generation and removes its virtual prototype projection without deleting existing ordinary instances

#### Scenario: Report a failed catch-up independently from an accepted definition change
- **WHEN** a recurrence prototype is created, revised, or resumed successfully but its immediate evaluation fails
- **THEN** the system retains the accepted prototype change, reports catch-up as a separate content-free failure, avoids an automatic retry loop for the same planning date, and exposes an explicit retry action

#### Scenario: Distinguish unavailable recurrence data from an empty list
- **WHEN** the recurrence prototype projection is loading or fails to load
- **THEN** the web interface presents the corresponding loading or failure state, withholds the empty-list claim, and disables recurrence mutation until the projection is trustworthy

#### Scenario: Hydrate an owner-safe recurrence response
- **WHEN** an authenticated recurrence RPC omits the owner identifier from its returned definition or revision
- **THEN** the client assigns the already authenticated owner to the parsed result while synchronized recurrence rows continue to validate their stored owner identifier

#### Scenario: Convert a legacy template-backed prototype
- **WHEN** the migration finds a valid current recurrence revision backed by a template revision
- **THEN** it copies the validated task and checklist snapshot into the recurrence revision before removing template dependencies

#### Scenario: Preserve a deferred reached instance during conversion
- **WHEN** a recurrence occurrence's immutable scheduled date is current or past but its task Start has been deferred into the future
- **THEN** migration preserves that occurrence and task as an ordinary instance and does not classify it as a removable future prototype

#### Scenario: Remove a legacy future projection during conversion
- **WHEN** a legacy recurrence occurrence's immutable scheduled date is future and it is the one materialized projection for its recurrence
- **THEN** migration captures its latest prototype content, removes that task and occurrence, and replaces them with the recurrence's virtual next-date projection

#### Scenario: Reject malformed legacy recurrence data
- **WHEN** a recurrence lacks a valid source snapshot, has cross-owner links, duplicate future projections, or another ambiguous conversion state
- **THEN** the migration aborts before deleting template or task data

### Requirement: Project-Free Production Contraction
The production Tasks data model SHALL remove Project and Template persistence only after a verified private backup and exact dependency audits, SHALL delete the authorized disposable records, and SHALL preserve all ordinary non-Project task instances and recurrence prototypes.

#### Scenario: Apply the approved destructive migration
- **WHEN** production matches the exact preflight for Projects, templates, recurrence definitions, future projections, and ordinary instances
- **THEN** the migration removes obsolete Project and Template persistence, converts recurrence prototypes, deletes only authorized disposable or legacy projection rows, and leaves ordinary task instances unchanged

#### Scenario: Fail closed on unexpected dependency content
- **WHEN** an exact Project, Template, or recurrence conversion assertion does not match at migration time
- **THEN** the transaction aborts before deleting or altering owner data

#### Scenario: Synchronize the contracted topology
- **WHEN** the template-free recurrence release is deployed
- **THEN** PowerSync publishes and projects exactly 17 approved Tasks tables and no client upload or read path references Projects or Templates

### Requirement: Project-Free Portable Tasks
Current Tasks exports SHALL use schema version 14 without Project or Template collections or references, and supported legacy exports SHALL normalize Project-contained tasks and template-backed recurrence prototypes without recreating retired wrappers.

#### Scenario: Export current template-free data
- **WHEN** the user creates a Tasks backup after the migration
- **THEN** the schema-14 envelope contains no Project or Template collection, identifier, provenance, reminder root, or recurrence template reference

#### Scenario: Restore a legacy Project task
- **WHEN** a supported legacy backup contains a task assigned to a Project
- **THEN** restore preserves the task and assigns the Project's Area directly when present, otherwise leaves the task unassigned, and creates no Project

#### Scenario: Discard a standalone legacy template
- **WHEN** a supported legacy backup contains a template that is not required by a recurrence
- **THEN** normalization excludes the template and its instantiation history and reports the deterministic removal without generating a task

#### Scenario: Convert a legacy recurrence snapshot
- **WHEN** a supported legacy backup contains a recurrence whose current revision references a valid template revision
- **THEN** normalization stores that snapshot on the recurrence revision and restores no reusable Template entity

#### Scenario: Reject an incomplete legacy recurrence snapshot
- **WHEN** a legacy recurrence references a missing or invalid template revision
- **THEN** restore preview fails closed with no owner data mutation

### Requirement: Task-Only Planning Roots
Tasks SHALL allow only ordinary tasks to own planning reminders and spawned-instance state, while recurrence definitions and revisions own recurrence prototype content and schedule without a Project or Template root.

#### Scenario: Save task-owned reminder planning
- **WHEN** the user or an authorized integration saves a reminder for ordinary work
- **THEN** the root resolves to a task and no Project or Template discriminator or identifier is accepted

#### Scenario: Save a recurrence prototype
- **WHEN** the user creates or edits repeating work
- **THEN** the definition and immutable current revision store the prototype content and cadence without creating a reusable Template entity or future task row

#### Scenario: Reject a retired Project or Template root
- **WHEN** a stale client or payload requests a Project or Template reminder, recurrence, hierarchy transition, instantiation, or organization assignment
- **THEN** the current database or application boundary rejects the unsupported contract without mutating owner data

## REMOVED Requirements

### Requirement: Native Templates
**Reason**: Reusable templates were conflated with recurrence prototypes and are not part of the currently intended Tasks product.

**Migration**: Current standalone template records and their history are intentionally deleted. Valid template snapshots referenced by recurrence revisions are copied into first-class recurrence prototype revisions before template storage is removed.

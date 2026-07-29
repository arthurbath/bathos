# Things Cutover Migration Specification

## Purpose

Define the one-time private, deterministic, and recoverable migration that established BathOS Tasks as the owner's authoritative task system.

## Requirements

### Requirement: Private consistent Things source
The migration system SHALL read Things only from a consistent owner-private snapshot and SHALL never mutate the live Things database.

#### Scenario: Create the migration source
- **WHEN** migration discovery begins with Full Disk Access
- **THEN** the system creates an owner-readable SQLite backup, verifies its integrity and digest, and performs subsequent reads through an immutable connection

#### Scenario: Reject an incompatible source
- **WHEN** the snapshot lacks an expected table, column, relationship, or supported recurrence shape
- **THEN** the migration stops before producing or applying a replacement envelope

### Requirement: Approved task scope
The migration SHALL import the approved open Things corpus and SHALL exclude historical or discarded Things content.

#### Scenario: Select open source lists
- **WHEN** the extractor selects Things roots
- **THEN** it includes open Anytime, Someday, Upcoming, and Today work and excludes Logbook, Trash, completed, canceled, and trashed roots

#### Scenario: Convert project templates
- **WHEN** an approved Things project contains open child tasks
- **THEN** the target contains one ordinary task for the project and ordered checklist items for its open children, without importing headings

### Requirement: Semantic mapping
The migration SHALL map supported Things meaning into native BathOS fields without embedding Things provenance or relationship metadata.

#### Scenario: Map planning
- **WHEN** a source task is Anytime, Someday, Today, or future-starting
- **THEN** the target is respectively horizon-free Anytime, Someday, Today Inbox, or future Start with no Today horizon

#### Scenario: Reconcile a snapshot across local midnight
- **WHEN** a private source snapshot contains a Start that has been reached or elapsed by the approved replacement date
- **THEN** the target enters Today Inbox with no persisted past Start

#### Scenario: Map actionability tags
- **WHEN** a source task has exact tag `⏳`, exact tag `🔄`, or neither tag
- **THEN** its target actionability is respectively Waiting, Rechecking, or Ready

#### Scenario: Preserve personal content
- **WHEN** a source task has a title, leading emoji, notes, supported link, deadline, reminder, area, or meaningful manual order
- **THEN** the target preserves that supported value in the corresponding native field

#### Scenario: Preserve extensible manual order
- **WHEN** source tasks, Areas, or checklist items are assigned deterministic target order
- **THEN** every generated key is valid for the shared fractional-indexing algorithm so ordinary post-cutover creation and reordering can append or insert records

#### Scenario: Omit Things metadata
- **WHEN** a target task is generated
- **THEN** it contains no Things ID, relationship description, tag label, heading, source-kind marker, provenance note, or other unstructured migration metadata

### Requirement: Native recurrence conversion
The migration SHALL represent every supported live Things recurrence as one native BathOS recurrence with exactly one current adopted occurrence.

#### Scenario: Adopt an open recurrence occurrence
- **WHEN** a Things recurrence template has one open linked occurrence
- **THEN** the target adopts that occurrence and does not create a second visible task for the Things template row

#### Scenario: Materialize a waiting recurrence
- **WHEN** a live recurrence has no open linked occurrence and has a valid next-instance date
- **THEN** the target materializes that next instance as the adopted task and retains the native recurrence for later events

#### Scenario: Preserve recurrence date semantics
- **WHEN** a decoded daily, weekly, monthly, yearly, calendar, after-completion, ordinal, last-day, or Deadline-offset rule is converted
- **THEN** BathOS preview and authoritative evaluation match the Things stored next-instance date and the decoded rule

#### Scenario: Reject a recurrence mismatch
- **WHEN** a converted rule cannot reproduce its stored Things next-instance date or yields an ambiguous source series
- **THEN** the migration fails closed before production replacement

### Requirement: Atomic authoritative replacement
The cutover SHALL replace the owner Tasks corpus atomically from a validated schema-13 envelope while retaining an independently verified recovery boundary.

#### Scenario: Preview replacement
- **WHEN** the target envelope is ready
- **THEN** the system validates its schema, manifest, relationships, recurrence graph, checklist order, private backup digest, and aggregate source-to-target reconciliation without mutating production

#### Scenario: Replace the corpus
- **WHEN** the verified preflight, exact backup digest, operation identifier, and destructive confirmation are supplied
- **THEN** one transaction replaces task-owned data, preserves approved owner settings and Areas, and returns a verifiable accepted outcome

#### Scenario: Replace immutable recurrence records
- **WHEN** the current corpus contains adopted or generated recurrence revisions, occurrences, evaluations, or status events
- **THEN** replacement deletes those rows only inside its private restore context and restores the validated recurrence graph atomically

#### Scenario: Recover a failed cutover
- **WHEN** replacement or acceptance fails
- **THEN** mutation remains stopped and the operator can restore the verified pre-cutover Tasks backup before capture resumes

### Requirement: Authoritative capture cutover
Every automated personal task capture path SHALL create new work in BathOS Tasks only after the cutover boundary.

#### Scenario: Process Mail once
- **WHEN** Inbox Manager accepts a new Mail message after cutover
- **THEN** it performs the existing AI refinement once, creates one idempotent Today Inbox task, and performs no Things credential, scripting, or write work

#### Scenario: Capture a webpage once
- **WHEN** the Raycast webpage workflow accepts a page after cutover
- **THEN** it performs its existing OpenAI preparation once, creates one BathOS task, and performs no Things write

#### Scenario: Reconcile the boundary
- **WHEN** an accepted or retrying pre-cutover capture exists
- **THEN** the operator drains or explicitly reconciles it before replacement and proves that it neither disappears nor creates a post-replacement duplicate

#### Scenario: Reject historical backfill
- **WHEN** Tasks-only capture is enabled
- **THEN** it processes new inputs only and does not backfill historical Mail or webpage work

### Requirement: Content-private completion evidence
The cutover SHALL prove completeness without publishing personal task content or credentials.

#### Scenario: Reconcile source and target
- **WHEN** migration acceptance runs
- **THEN** it reports aggregate counts and invariant checks for roots, templates, checklists, areas, planning states, actionability states, deadlines, reminders, and recurrences without task titles, notes, URLs, source IDs, or credentials

#### Scenario: Prove system health
- **WHEN** the cutover completes
- **THEN** Tasks rendering, PowerSync's exact approved table boundary, schedulers, advisors, reminders, Mail capture, webpage capture, and repository synchronization all pass before the migration is declared complete

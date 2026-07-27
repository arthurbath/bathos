## MODIFIED Requirements

### Requirement: Core Task Organization
The system SHALL organize active work through Anytime, Someday, Areas, tasks, and checklist items without headings, a separate Inbox destination, generic tags, multiple membership, or required parent containers.

#### Scenario: Maintain a checklist
- **WHEN** a user adds, edits, reorders, completes, reopens, or recoverably removes a checklist item
- **THEN** the checklist item remains owned by exactly one task and its completion state remains independent from the parent task's lifecycle

#### Scenario: Edit a checklist directly
- **WHEN** a user opens a task with or without an existing checklist
- **THEN** the expanded drawer permits adding, viewing, editing, checking, unchecking, deleting, focusing, and keyboard-traversing plain-text checklist items without an explicit Save action

#### Scenario: Open a checklist with the control shortcut
- **WHEN** a focused or open task receives the checklist keyboard command
- **THEN** Tasks opens the task if necessary, creates the first checklist row when none exists, and moves editing focus into the first available checklist item

#### Scenario: Remove an empty checklist row
- **WHEN** a checklist item's text is already empty and the user presses Backspace again
- **THEN** Tasks removes that item and moves editing focus to the preceding checklist row when one exists

#### Scenario: Clean empty checklist rows on close
- **WHEN** a task drawer closes with one or more empty checklist items
- **THEN** Tasks removes every empty checklist item regardless of completion state

#### Scenario: Move a completed checklist item
- **WHEN** a user checks an incomplete checklist item
- **THEN** Tasks smoothly moves that item beneath every incomplete item and after the already-completed items

#### Scenario: Preserve a manually reopened checklist position
- **WHEN** a user manually unchecks a completed checklist item
- **THEN** Tasks leaves the item at its current order position

#### Scenario: Undo a checklist change
- **WHEN** a user undoes or redoes a checklist edit, completion, deletion, creation, or reorder
- **THEN** Tasks restores or reapplies the exact prior checklist content, state, and order as one guarded history action

#### Scenario: Reorder checklist items manually
- **WHEN** a user drags one checklist item by its handle and drops it at another checklist position
- **THEN** Tasks updates its manual order and preserves that order across sessions and devices

#### Scenario: Capture new work for triage
- **WHEN** a user or supported integration creates a task without an explicit planning placement
- **THEN** the system creates one open present Anytime task with no Start and the Today Next horizon

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
- **WHEN** an active after-completion recurrence has an outstanding occurrence and therefore cannot yet derive its successor
- **THEN** Upcoming presents the recurrence once in a non-draggable Repeating Tasks section after its dated buckets

#### Scenario: Present calendar occurrences
- **WHEN** calendar recurrence evaluation generates future tasks
- **THEN** Upcoming presents each task in the one date bucket determined by its Start when present or otherwise its Deadline

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
- **THEN** the change creates a new revision that affects only future ungenerated occurrences and existing occurrences retain their source revision

#### Scenario: Pause recurrence
- **WHEN** a user pauses or archives a recurrence definition
- **THEN** the system stops future generation without deleting existing occurrences

#### Scenario: Report a failed catch-up independently from an accepted definition change
- **WHEN** a recurrence definition is created, revised, or resumed successfully but its immediate occurrence evaluation fails
- **THEN** the system retains the accepted definition change, reports catch-up as a separate content-free failure, avoids an automatic retry loop for the same planning date, and exposes an explicit retry action

### Requirement: Canonical Tasks Iconography
The Tasks module SHALL maintain and consistently reuse a documented Lucide icon for every established Tasks product concept, while preserving accessible text or programmatic names independently from the icon.

#### Scenario: Use canonical task-state controls
- **WHEN** Tasks presents an ordinary, Someday, or completed task leading control
- **THEN** it uses Lucide `Square`, `SquareDashed`, or `SquareCheck`, respectively, while reserving `SquareCheckBig` for the Tasks module icon

#### Scenario: Use canonical navigation icons
- **WHEN** Tasks represents Today, Someday, or Done in navigation
- **THEN** it uses Lucide `Star`, `SquareDashed`, or `ListChecks`, respectively

#### Scenario: Use the canonical add icon
- **WHEN** Tasks presents an action that adds a task or Area
- **THEN** it uses Lucide `Plus`

#### Scenario: Preserve approved existing concepts
- **WHEN** Tasks renders an established concept that is not explicitly overridden
- **THEN** it uses the canonical Lucide component recorded in the Tasks iconography reference rather than choosing a new icon independently at the rendering site

#### Scenario: Reuse one concept across surfaces
- **WHEN** one established Tasks concept appears in navigation, search, a list, a picker, a dialog, or another module surface
- **THEN** every occurrence uses the same canonical icon unless the iconography reference explicitly defines a distinct action concept

### Requirement: Directly recoverable Done task controls
Done SHALL present retained completed, canceled, and deleted tasks as fully inspectable, editable, selectable, and recoverable task states, grouped by their owner-local terminal-entry day and never drag-reorderable.

#### Scenario: Delete a task from its menu
- **WHEN** a user activates Delete in a task's ellipsis menu
- **THEN** Tasks recoverably deletes the task hierarchy and presents its root in Done as trashed

#### Scenario: Delete an open task
- **WHEN** a task is open and the user presses Command+Delete on Mac or the corresponding Windows shortcut
- **THEN** Tasks closes and recoverably deletes that task while unmodified Delete remains field-local

#### Scenario: Delete a focused task
- **WHEN** a closed whole-task-focused task receives Delete or the platform Command+Delete equivalent outside a text-entry control
- **THEN** Tasks recoverably deletes that task

#### Scenario: Delete selected tasks
- **WHEN** a user presses Delete with one or more tasks explicitly selected
- **THEN** Tasks applies the guarded recoverable deletion transition to every selected task and retains each accepted deletion in task history

#### Scenario: Reopen a completed task by unchecking it
- **WHEN** Done presents a completed present task
- **THEN** its leading control is a contained checked task checkbox, and activating that control reopens the task according to its current planning metadata

#### Scenario: Reopen a canceled task
- **WHEN** Done presents a canceled present task
- **THEN** its leading control communicates cancellation and activating it reopens the task through the same guarded lifecycle path

#### Scenario: Restore a deleted task from its trash control
- **WHEN** Done presents a recoverably deleted task root
- **THEN** its leading icon-only control shows a trash icon at rest, changes to a restore icon on hover or keyboard focus, and restores the task through the existing hierarchy-safe transition according to its current planning metadata

#### Scenario: Open and edit a terminal task
- **WHEN** a retained completed, canceled, or deleted task appears in Done
- **THEN** the user can open its ordinary drawer and edit every ordinarily editable metadata field without implicitly recovering it

#### Scenario: Select terminal tasks together
- **WHEN** Done contains completed, canceled, or deleted tasks
- **THEN** whole-task focus, single selection, multi-selection, and eligible bulk recovery treat them as peer task rows

#### Scenario: Group terminal work by day
- **WHEN** Done presents retained terminal tasks
- **THEN** it buckets them by the owner-local date on which each task was completed, canceled, or deleted and orders the newest bucket first

#### Scenario: Prohibit Done reordering
- **WHEN** a user views Done
- **THEN** Tasks exposes no single-task or multi-task drag reordering

#### Scenario: Retain terminal work for purge
- **WHEN** a task is completed, canceled, or deleted
- **THEN** its existing completion, cancellation, or deletion timestamp remains the Done grouping and 31-day retention timestamp until the task is recovered or purged

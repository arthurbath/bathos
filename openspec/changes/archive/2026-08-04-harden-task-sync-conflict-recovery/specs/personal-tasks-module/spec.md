## MODIFIED Requirements

### Requirement: Stable Manual Ordering
The system SHALL preserve intentional manual ordering across direct drag, keyboard moves, same-view Today horizon changes, saves, refreshes, offline operation, and synchronization.

#### Scenario: Reorder active work by drag
- **WHEN** a user drags an active task before or after another task in a supported ordered scope
- **THEN** the system saves the new fractional order and displays the committed placement without opening the dragged task's editor

#### Scenario: Limit task drag initiation to the summary row
- **WHEN** a task supports pointer reordering
- **THEN** only its summary row is a task-level drag source, and no pointer drag beginning in its expanded metadata editor initiates task reordering

#### Scenario: Collapse an open task at drag start
- **WHEN** a user begins dragging an open task from its summary row
- **THEN** Tasks begins collapsing the metadata editor, completes the ordinary autosave-aware close path, and continues the task reorder with the collapsed row

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

#### Scenario: Preserve Anytime rank through metadata changes
- **WHEN** a task remains in the Anytime destination while its Start, Today horizon, Deadline, actionability, organization, or other metadata changes
- **THEN** the system preserves its destination-wide manual order key rather than deriving rank from that metadata

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
- **THEN** the first accepted rank advances the revision and the later queued rank is replayed as the next authoritative placement with one recovered conflict receipt

### Requirement: Deterministic Task Reconciliation
The system SHALL use stable task identifiers, mutation identifiers, and optimistic integer revisions so stale task mutations are detected, recovered without overwriting unrelated concurrent fields, and never silently discarded while unresolved.

#### Scenario: Upload a current task revision
- **WHEN** a queued task mutation increments the server's current revision by one
- **THEN** the server accepts the mutation and the client removes it from the durable queue

#### Scenario: Rebase a stale field-level task mutation
- **WHEN** another client or server automation has advanced a task beyond a queued task PATCH's base revision
- **THEN** the client preserves the queued PATCH fields, rebases them onto the current authoritative revision, preserves unrelated authoritative fields, and retries with the original mutation identity and a contiguous revision

#### Scenario: Recover a planning edit racing due-task activation
- **WHEN** a user changes a task's start date or deadline while due-task activation advances the same task from the earlier revision
- **THEN** the user's queued planning fields are replayed onto the activated task, unrelated activation or task fields are preserved, and refresh does not restore the pre-edit planning values

#### Scenario: Recognize a rebased retry that already succeeded
- **WHEN** a rebased task write reaches the authoritative service but its success response is lost
- **THEN** a retry with the same mutation identity is classified as already applied and does not duplicate history or advance the revision again

#### Scenario: Retain a task mutation after bounded conflicts
- **WHEN** concurrent writers prevent a queued task PATCH from succeeding within the immediate retry bound or the authoritative task is unavailable
- **THEN** the client records a content-free pending-retry receipt, leaves the mutation in PowerSync's durable queue, and retries later instead of completing and discarding it

#### Scenario: Record automatic conflict recovery
- **WHEN** a stale queued task PATCH succeeds after one or more rebases
- **THEN** the client records or updates one content-free recovery receipt for that queued operation and removes the mutation from the durable queue

#### Scenario: Reconcile completion against a stale unrelated edit
- **WHEN** one client completes a task and another client uploads a field-level edit based on the same earlier revision
- **THEN** the completion remains authoritative while the unrelated edited fields are replayed onto the completed task

#### Scenario: Resolve competing writes to the same field
- **WHEN** two clients change the same scalar task field from the same earlier revision
- **THEN** the first accepted value advances the revision and the later queued field-level mutation is replayed as the next authoritative revision without losing unrelated fields

#### Scenario: Preserve immutable entry provenance
- **WHEN** web, native, MCP, or server automation mutations race on one task
- **THEN** reconciliation preserves immutable entry provenance while applying each accepted mutation's mutable actor and operation metadata

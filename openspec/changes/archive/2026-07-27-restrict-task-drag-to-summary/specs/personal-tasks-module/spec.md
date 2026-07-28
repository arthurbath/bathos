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
- **THEN** the first accepted revision remains authoritative and the stale reorder produces a conflict receipt rather than silently overwriting the accepted order

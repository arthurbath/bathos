## ADDED Requirements

### Requirement: Cross-Platform Task Interaction Reference
The system SHALL present a visible interaction reference that documents supported Tasks keyboard and pointer commands for both Mac and Windows while development validation is in progress.

#### Scenario: Compare platform commands
- **WHEN** the user opens Keyboard Commands
- **THEN** the interface shows Action, Mac, and Windows columns simultaneously and identifies the current platform when the runtime can detect it

#### Scenario: Discover direct list interactions
- **WHEN** the interaction reference is open
- **THEN** it documents undo, redo, modifier-click selection, anchored Shift-click range selection, ordinary selection toggling, drag reordering, and the existing keyboard task commands

#### Scenario: Preserve commands outside supported contexts
- **WHEN** an editable control, composition event, unrelated dialog, or unsupported task view owns an interaction
- **THEN** the reference does not imply that Tasks will override native editing, browser, or unsupported ordering behavior

## MODIFIED Requirements

### Requirement: Bulk Task Planning
The system SHALL provide an accessible task-row selection mode for open tasks and SHALL apply supported day-horizon, future scheduling, Anytime, or Someday actions to selected records as one local transaction.

#### Scenario: Enter selection with the platform modifier
- **WHEN** a user Command-clicks a visible task on Mac or Control-clicks a visible task on Windows while selection is inactive
- **THEN** the interface enters selection, makes that task the stable range anchor, selects it, reports the selected count, and does not open its editor

#### Scenario: Select a contiguous anchored range
- **WHEN** a user Shift-clicks a visible task after establishing a selection anchor
- **THEN** the interface replaces the prior range with the contiguous visible range between the original anchor and the clicked task without moving the anchor

#### Scenario: Replace an anchored range repeatedly
- **WHEN** a user Shift-clicks a different visible task while selection remains active
- **THEN** the interface replaces the previous range with the new contiguous range from the original anchor

#### Scenario: Toggle selection after entry
- **WHEN** selection is active and a user ordinarily clicks, Command-clicks on Mac, or Control-clicks on Windows on a visible task
- **THEN** the interface toggles that task's selected state without opening its editor

#### Scenario: Preserve ordinary task expansion
- **WHEN** selection is inactive and a user ordinarily clicks a task
- **THEN** the interface opens or closes that task's editor exactly as before

#### Scenario: Operate selection accessibly
- **WHEN** one or more visible tasks are selected in Today, Upcoming, Anytime, or Someday
- **THEN** the interface reports the selected count, exposes Select All and Clear, and communicates each selected state to keyboard and assistive-technology users without requiring a persistent header selection button

#### Scenario: Plan selected tasks
- **WHEN** a user applies Today Inbox, Today Now, Today Next, Today Later, Remove from Today, Tomorrow, Anytime, or Someday to selected tasks
- **THEN** the system updates every selected task's destination, day horizon, start date, mutation metadata, revision, and relevant order in one local transaction while preserving selected order

#### Scenario: Preserve a bulk horizon while scheduling
- **WHEN** a user applies a future date to selected tasks with an Inbox, Now, Next, or Later horizon
- **THEN** the system retains the requested horizon for every valid selected task while the tasks remain in Upcoming

#### Scenario: Reject one invalid bulk member
- **WHEN** any selected task is no longer open and present or the requested start date conflicts with one selected deadline
- **THEN** the system rejects the operation without writing any selected task and leaves selection available for correction or retry

#### Scenario: Keep bulk scope bounded
- **WHEN** the user exits selection, changes views, or completes a successful bulk plan
- **THEN** the client clears selection and its range anchor and returns to ordinary editing without adding bulk completion, deletion, or hierarchy mutation

### Requirement: Stable Manual Ordering
The system SHALL preserve intentional manual ordering across direct drag, keyboard or menu moves, saves, refreshes, offline operation, and synchronization.

#### Scenario: Reorder active work by drag
- **WHEN** a user drags an active task before or after another task in a supported ordered scope
- **THEN** the system saves the new fractional order and displays the committed placement without opening the dragged task's editor

#### Scenario: Retain non-pointer ordering
- **WHEN** a user cannot or does not use drag-and-drop
- **THEN** the interface retains keyboard and menu commands that move the focused task within the same supported scope

#### Scenario: Reorder sections of Today independently
- **WHEN** a user reorders work in Inbox, Now, Next, or Later
- **THEN** the system changes only that item's order within the same visible section and does not allow a drag or command to move it across Today sections

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

### Requirement: Recoverable History
The system SHALL provide append-only history, a guarded 100-step task undo and redo cursor, mutation receipts, a recoverable Done queue, versioned export, verified restore, and automatic terminal-data expiry.

#### Scenario: Undo a recent change
- **WHEN** a user invokes undo for the latest supported forward task mutation
- **THEN** the system restores the source event's prior state and synchronizes the restoration as a new valid undo mutation

#### Scenario: Undo a deep sequence
- **WHEN** the authoritative projected history contains a safe contiguous chain of supported task mutations
- **THEN** repeated Command+Z on Mac or Control+Z on Windows can walk backward through as many as 100 source mutations in reverse chronological order

#### Scenario: Redo an undone sequence
- **WHEN** one or more task mutations have been undone and no new forward mutation has invalidated redo
- **THEN** Command+Shift+Z on Mac or Control+Shift+Z on Windows reapplies the next source event's after-state as a new valid redo mutation

#### Scenario: Reconstruct task history after refresh
- **WHEN** the Tasks client starts with a synchronized append-only history projection
- **THEN** it reconstructs the bounded undo and redo cursor from forward, undo, and redo events without treating inverse events as new forward steps

#### Scenario: Invalidate redo after a new change
- **WHEN** a user makes a new supported forward task mutation after undoing one or more events
- **THEN** the client clears the redo path and retains the new mutation in the bounded undo path

#### Scenario: Keep undo and redo out of persistent header chrome
- **WHEN** the Tasks planning header renders
- **THEN** it does not expose visible Undo, Redo, or selection-mode buttons and leaves these interactions discoverable through Keyboard Commands

#### Scenario: Preserve native text history
- **WHEN** focus is in an input, textarea, select, content-editable surface, editor, or unrelated dialog
- **THEN** Tasks does not intercept native undo or redo keyboard commands

#### Scenario: Withhold unavailable or unsafe history movement
- **WHEN** no corresponding authoritative source event is projected, an inverse is pending, or current task state no longer matches the required source snapshot
- **THEN** the web interface does not submit a duplicate or speculative undo or redo mutation

#### Scenario: Reject an unsafe inverse
- **WHEN** intervening changes make an undo or redo snapshot pairing unsafe
- **THEN** the system rejects the inverse without overwriting current data and returns a conflict receipt

#### Scenario: Return a mutation receipt
- **WHEN** the system accepts, rejects, or treats a task mutation as a no-op
- **THEN** it returns a content-free receipt with the client mutation identifier, actor, channel, affected stable identifiers, revisions, transition, timestamp, outcome, and applicable code

#### Scenario: Delete a task
- **WHEN** a user deletes a to-do or project through the normal interface
- **THEN** the system moves it to a recoverable deleted state rather than immediately erasing it

#### Scenario: Restore deleted work
- **WHEN** a user restores a recoverably deleted item
- **THEN** the system restores the item and its supported descendants to their prior lifecycle, planning, parent, and order values when those destinations remain valid

#### Scenario: Restore work whose container no longer exists
- **WHEN** a recoverably deleted root cannot return to its prior container
- **THEN** the system restores the hierarchy to Anytime and reports the fallback in the mutation receipt

#### Scenario: Export task data
- **WHEN** a user requests an export
- **THEN** the system produces a versioned checksummed JSON envelope containing active and retained Done data without credentials or delivery tokens

#### Scenario: Preview a restore
- **WHEN** a user supplies an export for dry-run restore
- **THEN** the system validates checksums and schema compatibility and reports planned inserts, matches, and conflicts without writing task data

#### Scenario: Merge a restore
- **WHEN** a user restores an export into existing data
- **THEN** the system assigns records to the authenticated owner, matches by stable identifier, remains idempotent on retry, and reports conflicts without overwriting newer records

#### Scenario: Recover after complete source loss
- **WHEN** the source account and its server rows no longer exist and the user merges a verified current backup under another authenticated owner
- **THEN** every portable collection is rebound to that owner atomically, including append-only history and recoverably deleted work, while excluded credentials and delivery diagnostics remain absent

#### Scenario: Replay an exact current backup
- **WHEN** the user retries a current-schema backup after its complete merge already succeeded
- **THEN** every collection is reported as an exact match, no row is rewritten or duplicated, and legacy compatibility conversion does not create a false conflict

#### Scenario: Reject backup tampering
- **WHEN** exported content no longer matches its manifest checksum
- **THEN** preview and merge reject the envelope before any task data is written

#### Scenario: Replace data from a restore
- **WHEN** a user explicitly selects replace restore
- **THEN** the system limits replacement to the complete current export schema, returns a checksum-verified pre-restore server backup, requires that backup to be downloaded plus a separate exact confirmation, and atomically replaces task data only while the server snapshot still matches the downloaded backup digest

#### Scenario: Prepare replacement without blocking task writes globally
- **WHEN** an authenticated user validates an incoming replacement and requests the current pre-restore backup
- **THEN** preparation reads one transaction-consistent snapshot without taking a table-wide task write lock, while confirmed replacement retains the atomic lock and stale-backup check

#### Scenario: Reject a stale replacement backup
- **WHEN** synchronized task data changes after the pre-restore backup is prepared and before replacement executes
- **THEN** the server rejects the stale backup digest without deleting or restoring any task record and requires a fresh preparation

#### Scenario: Recover from replacement failure
- **WHEN** a validated replacement envelope cannot be restored because of a stable-identifier collision or another transactional failure
- **THEN** the complete deletion and restore transaction rolls back, the prior owner task graph remains visible, and an exact ambiguous-response retry either resumes safely or returns the original content-free receipt

#### Scenario: Preserve delivery registration during replacement
- **WHEN** task data is replaced
- **THEN** the system removes task-specific reminder delivery diagnostics while retaining excluded browser delivery targets and credentials so the current device does not become silently unregistered

#### Scenario: Recover work from Done
- **WHEN** a user restores deleted work or reopens completed or canceled work before its purge boundary
- **THEN** the system returns the work to a valid active state and removes it from Done

#### Scenario: Retain work for 30 full local days
- **WHEN** work enters Done on an owner's local calendar date
- **THEN** the system retains it throughout that date and the following 30 local midnights

#### Scenario: Purge at the start of the 31st day
- **WHEN** the owner's planning time zone reaches midnight beginning the 31st calendar day after work entered Done
- **THEN** the server permanently erases the terminal content graph within one minute and the deletion converges to connected and later-reconnected clients

#### Scenario: Preserve safety receipts after purge
- **WHEN** purged work originated from idempotent capture, a template, recurrence, or a hierarchy operation
- **THEN** the system retains only content-free receipts required to prevent duplicate recreation and removes personal task content, sources, reminders, and terminal history not required for that safety

#### Scenario: Read an older export
- **WHEN** a user previews a supported older export containing Inbox, Today, daytime, evening, Logbook, or Trash state
- **THEN** the system deterministically normalizes it to Anytime, Today membership, and Done before reporting inserts, matches, and conflicts

#### Scenario: Replace from a verified backup
- **WHEN** a user confirms replacement from a compatible verified export
- **THEN** the system creates a pre-restore backup, replaces the synchronized task graph atomically, and preserves the authenticated owner boundary

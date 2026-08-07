## MODIFIED Requirements

### Requirement: Unified task action history
Tasks SHALL make every accepted discrete user action affecting tasks or their checklist items immediately undoable through one chronological device-local application-history command and redoable until a new forward user action invalidates the redo path. Tasks SHALL retain at most 100 accepted local actions for 30 minutes on the current installation while continuing to synchronize every forward, undo, and redo mutation through ordinary authoritative task history.

#### Scenario: Own history inside task fields
- **WHEN** focus is in an editable task or checklist field and the user invokes a documented Tasks undo or redo command outside active composition
- **THEN** Tasks consumes the command and invokes application history rather than leaving it to isolated browser-native field history

#### Scenario: Flush a pending task edit
- **WHEN** the user invokes undo while an open task has a pending title, notes, link, checklist, or metadata save
- **THEN** Tasks first commits that pending edit to the local-first store and then undoes that exact accepted action instead of traversing an older action

#### Scenario: Undo every supported discrete action
- **WHEN** the latest accepted local action changes task text, checklist content or order, metadata, task order, lifecycle state, deletion state, completion state, or clipboard-created or clipboard-removed work
- **THEN** one undo invocation immediately restores the exact semantic state before that discrete user action without waiting for a synchronized history projection

#### Scenario: Undo checklist completion and automatic sinking atomically
- **WHEN** checking a checklist item both completes it and moves it beneath the unfinished items
- **THEN** one undo invocation immediately restores both its unchecked state and its exact prior position as one action

#### Scenario: Redo the undone action
- **WHEN** the user has undone one or more actions and has not performed a new forward action
- **THEN** each redo invocation immediately reapplies the next undone action in chronological order without waiting for a synchronized history projection

#### Scenario: Invalidate redo with new work
- **WHEN** the user performs a new accepted forward action after undoing one or more actions
- **THEN** Tasks clears the incompatible redo path without changing the preserved applied undo history

#### Scenario: Undo task creation
- **WHEN** a user undoes a newly created or pasted task
- **THEN** Tasks recoverably removes the complete created task hierarchy as one guarded history action and makes the exact creation available to redo

#### Scenario: Undo a grouped action
- **WHEN** one bulk, cut, paste, drag, or other discrete gesture affects multiple tasks or checklist items
- **THEN** Tasks records and traverses the complete accepted gesture as one atomic undo or redo operation

#### Scenario: Interleave task and checklist actions
- **WHEN** accepted task and checklist actions occur in any order
- **THEN** the one local journal traverses them in exact reverse chronological order for undo and forward chronological order for redo without choosing between separate history streams

#### Scenario: Undo while offline
- **WHEN** the current installation is offline and the latest accepted action remains in the local journal
- **THEN** Tasks immediately applies its guarded inverse locally and queues the resulting mutation for ordinary synchronization

#### Scenario: Retain recent history across relaunch
- **WHEN** Tasks relaunches on the same installation within 30 minutes of accepted local actions
- **THEN** it reconstructs the local undo and redo cursor from the unexpired journal rows

#### Scenario: Expire local history
- **WHEN** an action is older than 30 minutes or exceeds the newest 100 accepted actions
- **THEN** Tasks removes it from the interactive local cursor without deleting its authoritative synchronized history

#### Scenario: Reject an unsafe traversal
- **WHEN** current synchronized entity state no longer semantically matches the state required by an undo or redo action
- **THEN** Tasks preserves current data and the local cursor and reports that the action could not be traversed because the item changed elsewhere

#### Scenario: Distinguish an empty boundary from a history failure
- **WHEN** the local journal contains no eligible action
- **THEN** Tasks performs no mutation and shows the ordinary Nothing to Undo or Nothing to Redo message
- **WHEN** the journal query, schema, storage, or replay operation fails
- **THEN** Tasks reports the specific history failure and does not show a Nothing to Undo or Nothing to Redo boundary message

#### Scenario: Preserve authoritative server history
- **WHEN** Tasks accepts a forward, undo, or redo mutation from the local journal
- **THEN** the ordinary synchronized data path appends authoritative server history without making that projection a prerequisite for the interactive command

### Requirement: Tasks synchronized-cache schema compatibility
The Tasks runtime SHALL verify every required synchronized-history and local-history table column before exposing the ready interface and SHALL replace an incompatible local cache only when doing so cannot discard a pending upload.

#### Scenario: Open a compatible cache
- **WHEN** the required task history, hierarchy history, and local action-journal columns are queryable
- **THEN** Tasks continues startup without replacing the local cache

#### Scenario: Repair an incompatible cache safely
- **WHEN** a required local history column or table is unavailable and the upload queue is readable and empty
- **THEN** Tasks advances the local database generation, opens a fresh compatible cache, and reports the bounded recovery outcome

#### Scenario: Preserve pending offline work
- **WHEN** a required local history column or table is unavailable and the upload queue is nonempty or cannot be read
- **THEN** Tasks does not replace the cache, does not discard pending mutations, and presents a recoverable startup failure

#### Scenario: Prevent query mocks from substituting for schema coverage
- **WHEN** automated validation runs
- **THEN** it verifies the columns required by real task and checklist history queries against the generated PowerSync schema and exercises startup from an incompatible legacy cache

## MODIFIED Requirements

### Requirement: Unified task action history
Tasks SHALL make every accepted discrete user action affecting tasks or their checklist items immediately eligible for undo through one chronological application-history command and redoable until a new forward user action invalidates the redo path. Tasks SHALL resolve an accepted action against its exact authoritative history operation before applying an inverse, even when history projection is asynchronous.

#### Scenario: Own history inside task fields
- **WHEN** focus is in an editable task or checklist field and the user invokes a documented Tasks undo or redo command outside active composition
- **THEN** Tasks consumes the command and invokes authoritative application history rather than leaving it to isolated browser-native field history

#### Scenario: Flush a pending task edit
- **WHEN** the user invokes undo while an open task has a pending title, notes, link, checklist, or metadata save
- **THEN** Tasks first commits that pending edit and then undoes the resulting authoritative mutation instead of traversing an older action

#### Scenario: Undo every supported discrete action
- **WHEN** the latest accepted action changes task text, checklist content or order, metadata, task order, lifecycle state, deletion state, completion state, or clipboard-created or clipboard-removed work
- **THEN** one undo invocation restores the exact state before that discrete user action

#### Scenario: Undo a checklist action before history projects
- **WHEN** a checklist insertion, text edit, completion change, deletion, or reorder has been accepted but its hierarchy-history event has not yet appeared in the local projection and the user invokes Undo
- **THEN** Tasks immediately acknowledges the command, waits for the exact accepted checklist action to project, and undoes that action instead of reporting an empty history boundary or traversing an older action

#### Scenario: Redo the undone action
- **WHEN** the user has undone one or more actions and has not performed a new forward action
- **THEN** each redo invocation reapplies the next undone action in chronological order

#### Scenario: Invalidate redo with new work
- **WHEN** the user performs a new forward action after undoing one or more actions
- **THEN** Tasks clears the incompatible redo path without changing the preserved undo history

#### Scenario: Undo task creation
- **WHEN** a user undoes a newly created or pasted task
- **THEN** Tasks recoverably removes the complete created task hierarchy as one guarded history action and makes the exact creation available to redo

#### Scenario: Undo a grouped clipboard action
- **WHEN** one cut or paste gesture affects multiple tasks or checklist items
- **THEN** Tasks records and traverses the complete accepted gesture as one atomic undo or redo operation

#### Scenario: Undo a grouped checklist reorder
- **WHEN** one reorder gesture changes the order of one or more checklist items
- **THEN** Tasks restores every affected item's prior order as one undo action and reapplies the complete moved order as one redo action

#### Scenario: Choose the newest history stream
- **WHEN** task history and checklist history contain traversable or accepted-pending actions
- **THEN** Undo selects the newest accepted action across both streams and Redo follows the inverse route established by prior undo traversal

#### Scenario: Reject an unsafe traversal
- **WHEN** synchronized current state no longer exactly matches the state required by an undo or redo action
- **THEN** Tasks preserves current data, preserves the authoritative cursor, and reports the conflict without applying a partial inverse

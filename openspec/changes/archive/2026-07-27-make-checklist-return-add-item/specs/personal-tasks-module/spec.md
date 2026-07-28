## MODIFIED Requirements

### Requirement: Core Task Organization
The system SHALL organize active work through Anytime, Someday, Areas, tasks, and checklist items without headings, a separate Inbox destination, generic tags, multiple membership, or required parent containers.

#### Scenario: Maintain a checklist
- **WHEN** a user adds, edits, reorders, completes, reopens, or recoverably removes a checklist item
- **THEN** the checklist item remains owned by exactly one task and its completion state remains independent from the parent task's lifecycle

#### Scenario: Edit a checklist directly
- **WHEN** a user opens a task with or without an existing checklist
- **THEN** the expanded drawer permits adding, viewing, editing, checking, unchecking, deleting, focusing, and keyboard-traversing plain-text checklist items without an explicit Save action

#### Scenario: Present an empty checklist item
- **WHEN** a checklist item has no text
- **THEN** its input shows the placeholder `Item`

#### Scenario: Continue a checklist with Return
- **WHEN** a user presses unmodified Return in a checklist-item input outside active composition
- **THEN** Tasks commits the current accepted text, inserts and focuses one new empty checklist-item input, and keeps the task editor open

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

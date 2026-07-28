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
- **THEN** its input shows the placeholder `Item`, displays its reorder handle immediately, and remains removable when the task closes

#### Scenario: Split a checklist item with Return
- **WHEN** a user presses unmodified Return in a checklist-item input outside active composition
- **THEN** Tasks saves the text before the caret or selection, inserts and focuses one checklist-item input immediately below containing the text after the caret or selection, removes selected text as the line-break replacement, places the caret at the beginning of the new item, and keeps the task editor open

#### Scenario: Traverse checklist items with vertical arrows
- **WHEN** a user presses Down Arrow or Up Arrow in a checklist-item input that has an adjacent item in that direction
- **THEN** Tasks focuses the adjacent checklist input and places its caret at the end of that item's value regardless of the original caret position

#### Scenario: Preserve vertical-arrow boundary behavior
- **WHEN** a user presses Up Arrow in the first checklist item or Down Arrow in the final checklist item
- **THEN** Tasks does not move focus outside the checklist and leaves the input's native boundary behavior intact

#### Scenario: Join a checklist item backward
- **WHEN** the caret is at the beginning of a checklist-item input and the user presses Backspace
- **THEN** Tasks appends the current item's text to the preceding item, removes the current item, and places the caret at the former boundary in the preceding input

#### Scenario: Remove the first empty checklist item
- **WHEN** the first checklist-item input is empty and the user presses Backspace
- **THEN** Tasks removes that item because no preceding checklist line exists to receive it

#### Scenario: Join a checklist item forward
- **WHEN** the caret is at the end of a checklist-item input and the user presses forward Delete
- **THEN** Tasks appends the following item's text to the current item, removes the following item, and leaves the caret at the former boundary in the current input

#### Scenario: Keep selection local to one checklist input
- **WHEN** a user presses Command+A or Control+A while editing a checklist item
- **THEN** the browser selects only the text in that active input

#### Scenario: Open a checklist with the control shortcut
- **WHEN** a focused or open task receives the checklist keyboard command
- **THEN** Tasks opens the task if necessary and focuses the end of the final unchecked checklist item, or creates and focuses one empty checklist row when no unchecked item exists

#### Scenario: Remove empty checklist rows on close
- **WHEN** a task drawer closes with one or more empty checklist items
- **THEN** Tasks removes every empty checklist item regardless of completion state

#### Scenario: Present checklist insertion and deletion without motion
- **WHEN** a checklist item is created or removed
- **THEN** Tasks updates the checklist without sliding, translating, or otherwise animating the affected rows

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
- **WHEN** a user drags a persisted or empty checklist item by its handle and drops it at another checklist position
- **THEN** Tasks updates its visible order, persists that order for nonempty items across sessions and devices, and keeps the pointer-only handle outside the Tab order

#### Scenario: Avoid redundant checklist append controls
- **WHEN** a checklist already contains an item or an empty editing row
- **THEN** Tasks does not show a separate Add Checklist Item button because Return provides the append interaction

#### Scenario: Capture new work for triage
- **WHEN** a user or supported integration creates a task without an explicit planning placement
- **THEN** the system creates one open present Anytime task with no Start and the Today Next horizon

## ADDED Requirements

### Requirement: Configurable Task Drag Handles
The Tasks module SHALL persist an account-level Drag Handles preference with Hidden, Always, and Touch Devices Only choices. The preference SHALL default to Hidden, SHALL resolve Touch Devices Only from the current device's touch capability, and SHALL NOT remove an otherwise supported row-based drag path when handles are not visible.

#### Scenario: Keep handles hidden by default
- **WHEN** an account has not chosen a Drag Handles preference
- **THEN** eligible task and checklist rows show no dedicated grip handle and retain their existing reorder interactions

#### Scenario: Show handles everywhere
- **WHEN** the preference is Always
- **THEN** every otherwise reorderable task, recurrence prototype, and checklist item shows its dedicated grip handle on point-and-click and touch devices

#### Scenario: Show handles only on touch devices
- **WHEN** the preference is Touch Devices Only
- **THEN** eligible handles appear when the current client reports touch capability and remain hidden on a point-and-click-only client

#### Scenario: Place task handles after row actions
- **WHEN** an eligible task or recurrence prototype shows a drag handle
- **THEN** the handle appears at the trailing edge of its summary row after the ellipsis action when that action is present

#### Scenario: Place checklist handles at the trailing edge
- **WHEN** an eligible checklist item shows a drag handle
- **THEN** the handle appears at the trailing edge of the checklist row without replacing its completion, selection, or text-editing controls

#### Scenario: Begin an immediate handle drag
- **WHEN** a primary mouse, pen, or touch pointer presses and moves from an exposed handle
- **THEN** Tasks immediately begins reordering the associated task, selected task group, checklist item, or selected checklist group without a long-press delay

#### Scenario: Preserve scrolling outside handles
- **WHEN** a touch gesture begins anywhere outside an exposed handle
- **THEN** Tasks leaves native list scrolling, momentum, and existing row gestures available

#### Scenario: Restrict touch suppression to the handle
- **WHEN** a touch gesture begins directly on an exposed handle
- **THEN** Tasks prevents browser scrolling for that gesture, captures the pointer, and updates the established list insertion indicator as the pointer moves

#### Scenario: Reuse established drop rules
- **WHEN** a handle drag ends over or after crossing a valid insertion position
- **THEN** Tasks applies the same eligibility, grouped ordering, autosave boundary, persistence, undo history, and rollback rules as the corresponding existing row drag

#### Scenario: Reject an unsupported handle
- **WHEN** a task or checklist item cannot legally be reordered in its current surface or state
- **THEN** Tasks does not expose an operative drag handle for that item

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
- **THEN** its input shows the placeholder `Item`, exposes the complete row and input surface for direct reordering, and remains removable when the task closes

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

#### Scenario: Insert a checklist item with the control shortcut
- **WHEN** a focused or open task receives the checklist keyboard command
- **THEN** Tasks opens the task if necessary, creates one empty checklist row immediately before the first completed checklist item, and focuses that new row
- **AND** when no completed checklist item exists, Tasks appends and focuses the new empty row at the end of the checklist

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

#### Scenario: Edit or reorder from the checklist input
- **WHEN** a user presses and releases a checklist-item input without beginning a drag
- **THEN** Tasks focuses the input and permits ordinary text editing at the clicked caret position

#### Scenario: Reorder checklist items directly
- **WHEN** a user drags a persisted or empty checklist item from its row, text-input surface, or a visible dedicated handle and drops it at another checklist position
- **THEN** Tasks updates its visible order and persists that order for nonempty items across sessions and devices

#### Scenario: Avoid redundant checklist append controls
- **WHEN** a checklist already contains an item or an empty editing row
- **THEN** Tasks does not show a separate Add Checklist Item button because Return provides the append interaction

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

#### Scenario: Edit or reorder from the checklist input
- **WHEN** a user presses and releases a checklist-item input without beginning a drag
- **THEN** Tasks focuses the input and permits ordinary text editing at the clicked caret position

#### Scenario: Reorder checklist items directly
- **WHEN** a user drags a persisted or empty checklist item from its row or text-input surface and drops it at another checklist position
- **THEN** Tasks updates its visible order, persists that order for nonempty items across sessions and devices, and does not require or display a dedicated reorder handle

#### Scenario: Avoid redundant checklist append controls
- **WHEN** a checklist already contains an item or an empty editing row
- **THEN** Tasks does not show a separate Add Checklist Item button because Return provides the append interaction

### Requirement: Checklist Multi-Selection
Tasks SHALL let users temporarily select persisted checklist items within one open task for grouped reordering and deletion without presenting task-style bulk controls, retaining text-entry focus, or applying group completion changes. Every persisted checklist row SHALL distinguish an ordinary click from a native drag so the same row surface can begin item editing, reorder one item, or reorder the selected group without requiring a dedicated handle.

#### Scenario: Begin additive selection from a focused item
- **WHEN** keyboard focus is inside one checklist-item input and the user Command-clicks another checklist item
- **THEN** Tasks selects and visibly highlights both the focused item and the modified-clicked item, relinquishes text-entry focus, and removes the visible text caret

#### Scenario: Extend additive selection
- **WHEN** one or more checklist items are selected and the user Command-clicks another persisted checklist item
- **THEN** Tasks toggles that item in the selection while retaining the other selected items and keeping text-entry focus absent

#### Scenario: Select an anchored range
- **WHEN** a checklist item is focused or is the current selection anchor and the user Shift-clicks another persisted checklist item
- **THEN** Tasks selects and visibly highlights the contiguous visual range between the anchor and the clicked item, relinquishes text-entry focus, and removes the visible text caret

#### Scenario: Keep text and completion actions item-local
- **WHEN** checklist items are selected
- **THEN** Tasks presents no bulk-action bar, has no active text-entry target, and does not apply an edit, completion, or reopening action to the group

#### Scenario: Return to editing with an ordinary input click
- **WHEN** checklist items are selected and the user single-clicks a selected checklist-item input without moving far enough to begin a native drag
- **THEN** Tasks clears checklist multi-selection, focuses that input, preserves the clicked caret position, and permits ordinary text editing

#### Scenario: Return to editing from selected row space
- **WHEN** checklist items are selected and the user single-clicks the non-checkbox surface of a selected checklist row without moving far enough to begin a native drag
- **THEN** Tasks clears checklist multi-selection and focuses that row's checklist input for editing

#### Scenario: Preserve direct completion on an ordinary click
- **WHEN** checklist items are selected and the user single-clicks one checklist item's checkbox
- **THEN** Tasks clears checklist multi-selection and applies completion or reopening only to the clicked item without forcing focus into its text input

#### Scenario: Deselect from elsewhere in the drawer
- **WHEN** checklist items are selected and the user single-clicks elsewhere in the task drawer
- **THEN** Tasks clears checklist multi-selection while allowing the clicked control's ordinary action to continue

#### Scenario: Reorder a selected checklist group by its row
- **WHEN** the user presses and drags any selected persisted checklist row or its text input far enough to begin a native drag and drops it at another checklist position
- **THEN** Tasks moves every selected item as one visual-order group, persists the resulting order for nonempty items, and keeps the moved items selected

#### Scenario: Do not convert an input-originated row drag into editing
- **WHEN** a selected checklist row begins a native drag from its checklist text input
- **THEN** Tasks preserves checklist selection, relinquishes input focus, removes the visible text caret, and does not restore input focus through the ordinary click path

#### Scenario: Preserve ordinary single-item drag
- **WHEN** the user drags an unselected checklist item from its row or text-input surface
- **THEN** Tasks reorders only that item without adding selection styling or entering checklist multi-selection

#### Scenario: Delete a selected checklist group
- **WHEN** checklist items are selected and the user presses Delete or Backspace outside active text composition
- **THEN** Tasks removes every selected checklist item, clears checklist multi-selection, and prevents ordinary character or line-join deletion behavior

#### Scenario: Reconcile selection with checklist changes
- **WHEN** selected checklist items disappear because of deletion, task closure, or a synchronized update
- **THEN** Tasks removes unavailable item identifiers from the transient selection and clears the anchor when it no longer exists

#### Scenario: Capture new work for triage
- **WHEN** a user or supported integration creates a task without an explicit planning placement
- **THEN** the system creates one open present Anytime task with no Start and the Today Next horizon

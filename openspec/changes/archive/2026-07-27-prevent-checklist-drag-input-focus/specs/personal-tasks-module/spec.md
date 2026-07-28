## MODIFIED Requirements

### Requirement: Checklist Multi-Selection
Tasks SHALL let users temporarily select persisted checklist items within one open task for grouped reordering and deletion without presenting task-style bulk controls, retaining text-entry focus, or applying group completion changes. A selected persisted checklist row SHALL distinguish an ordinary click from a native drag so the same row surface can return to item editing or begin a selected-group reorder.

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

#### Scenario: Reorder a selected checklist group by its handle
- **WHEN** the user drags the handle of any selected checklist item and drops it at another checklist position
- **THEN** Tasks moves every selected item as one contiguous group at that position, preserves their prior visual order, persists the resulting order for nonempty items, and keeps the moved items selected

#### Scenario: Reorder a selected checklist group by its row
- **WHEN** the user presses and drags any selected persisted checklist row far enough to begin a native drag and drops it at another checklist position
- **THEN** Tasks treats the gesture like dragging that item's handle, moves every selected item as one visual-order group, and keeps the moved items selected

#### Scenario: Do not convert an input-originated row drag into editing
- **WHEN** a selected checklist row begins a native drag from its checklist text input
- **THEN** Tasks preserves checklist selection, relinquishes input focus, removes the visible text caret, and does not restore input focus through the ordinary click path

#### Scenario: Preserve ordinary single-item drag
- **WHEN** the user drags the handle of an unselected checklist item
- **THEN** Tasks reorders only that item using the existing checklist drag behavior

#### Scenario: Delete a selected checklist group
- **WHEN** checklist items are selected and the user presses Delete or Backspace outside active text composition
- **THEN** Tasks removes every selected checklist item, clears checklist multi-selection, and prevents ordinary character or line-join deletion behavior

#### Scenario: Reconcile selection with checklist changes
- **WHEN** selected checklist items disappear because of deletion, task closure, or a synchronized update
- **THEN** Tasks removes unavailable item identifiers from the transient selection and clears the anchor when it no longer exists

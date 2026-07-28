## MODIFIED Requirements

### Requirement: Checklist Multi-Selection
Tasks SHALL let users temporarily select persisted checklist items within one open task for grouped reordering and deletion without presenting task-style bulk controls, retaining text-entry focus, or applying group completion changes. Every persisted checklist row SHALL distinguish an ordinary click from a native drag so the same row surface can begin item editing, reorder one item, or reorder the selected group without requiring a dedicated handle. While checklist multi-selection is active, every persisted checklist item SHALL replace its completion control with the canonical circular selection control without changing the item's persisted completion state or completed-text treatment.

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

#### Scenario: Present checklist selection controls
- **WHEN** checklist multi-selection is active
- **THEN** every persisted item shows a blue Lucide `CircleCheck` when selected or a blue Lucide `Circle` when unselected in place of its ordinary completion checkbox

#### Scenario: Toggle selection from a checklist selection control
- **WHEN** checklist multi-selection is active and the user clicks one checklist item's circular selection control
- **THEN** Tasks toggles only that item's transient selection state, preserves selection mode while any item remains selected, and does not change the item's completion state

#### Scenario: Preserve completed-item treatment during selection
- **WHEN** a completed checklist item is selected or unselected while checklist multi-selection remains active
- **THEN** its text remains struck through and muted so its completion state stays visible independently of selection

#### Scenario: Return to editing with an ordinary input click
- **WHEN** checklist items are selected and the user single-clicks a selected checklist-item input without moving far enough to begin a native drag
- **THEN** Tasks clears checklist multi-selection, focuses that input, preserves the clicked caret position, and permits ordinary text editing

#### Scenario: Return to editing from selected row space
- **WHEN** checklist items are selected and the user single-clicks the non-checkbox surface of a selected checklist row without moving far enough to begin a native drag
- **THEN** Tasks clears checklist multi-selection and focuses that row's checklist input for editing

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

## ADDED Requirements

### Requirement: Unified Task And Checklist Selection Presentation
Tasks SHALL use canonical Lucide `Circle` and `CircleCheck` selection indicators with the semantic info-blue color and SHALL use the checklist selection blue as the shared background treatment for closed task focus, explicit task selection, and checklist item selection.

#### Scenario: Highlight a focused closed task
- **WHEN** a closed task receives whole-task keyboard focus
- **THEN** its row uses the same blue background highlight used by a selected checklist item

#### Scenario: Highlight explicitly selected tasks
- **WHEN** one or more tasks are in explicit selection mode
- **THEN** every selected task uses the shared blue background highlight and a blue Lucide `CircleCheck`, while unselected tasks expose a blue Lucide `Circle`

#### Scenario: Open a blue-highlighted task
- **WHEN** a blue-highlighted focused or explicitly selected task is opened
- **THEN** its background transitions to the existing gray expanded-task surface while the editor opens

#### Scenario: Use selection presentation in Done
- **WHEN** a Done-list task receives whole-task focus or explicit selection
- **THEN** it uses the same blue task-selection presentation as an active-list task

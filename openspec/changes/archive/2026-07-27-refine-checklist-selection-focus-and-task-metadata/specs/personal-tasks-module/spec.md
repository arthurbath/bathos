## MODIFIED Requirements

### Requirement: Checklist Multi-Selection
Tasks SHALL let users temporarily select persisted checklist items within one open task for grouped reordering and deletion without presenting task-style bulk controls, retaining text-entry focus, or applying group completion changes.

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

#### Scenario: Deselect with an ordinary click
- **WHEN** checklist items are selected and the user single-clicks a checklist item without a selection modifier or clicks elsewhere in the task drawer
- **THEN** Tasks clears checklist multi-selection while allowing the clicked control's ordinary action to continue

#### Scenario: Reorder a selected checklist group
- **WHEN** the user drags the handle of any selected checklist item and drops it at another checklist position
- **THEN** Tasks moves every selected item as one contiguous group at that position, preserves their prior visual order, persists the resulting order for nonempty items, and keeps the moved items selected

#### Scenario: Preserve ordinary single-item drag
- **WHEN** the user drags the handle of an unselected checklist item
- **THEN** Tasks reorders only that item using the existing checklist drag behavior

#### Scenario: Delete a selected checklist group
- **WHEN** checklist items are selected and the user presses Delete or Backspace outside active text composition
- **THEN** Tasks removes every selected checklist item, clears checklist multi-selection, and prevents ordinary character or line-join deletion behavior

#### Scenario: Reconcile selection with checklist changes
- **WHEN** selected checklist items disappear because of deletion, task closure, or a synchronized update
- **THEN** Tasks removes unavailable item identifiers from the transient selection and clears the anchor when it no longer exists

### Requirement: Consistent Tasks list density
The interface SHALL present Tasks list and grouping headings without item-count adornments, SHALL keep every collapsed task at a dense uniform height, and SHALL present optional task metadata in the stable order Area, Reminder, Deadline, Checklist, and Actionability as flat inline content without resting card or chip decoration or bold typography.

#### Scenario: Keep closed rows uniform
- **WHEN** a list contains collapsed tasks with different combinations of hierarchy, checklist content, actionability, deadline, reminder, or other secondary details
- **THEN** every collapsed task row occupies the same 44-pixel height

#### Scenario: Keep secondary details compact
- **WHEN** a collapsed task has one or more secondary details
- **THEN** the interface presents those details in one bounded nonwrapping metadata line without increasing the row height

#### Scenario: Omit absent task metadata
- **WHEN** any canonical secondary metadata item is unavailable or not applicable to a task
- **THEN** the item is absent without a placeholder and the remaining items preserve their relative canonical order

#### Scenario: Present checklist presence
- **WHEN** a task contains at least one checklist item
- **THEN** its metadata line presents the established Task checklist icon immediately before actionability without a count or written label

#### Scenario: Omit an empty checklist indicator
- **WHEN** a task has no checklist items
- **THEN** its metadata line does not present the Task checklist icon

#### Scenario: Compress actionability on mobile
- **WHEN** a mobile task row presents Waiting or Rechecking actionability
- **THEN** the flat metadata line presents that state's established symbol without its written label while preserving the complete actionability name for assistive technology

#### Scenario: Preserve actionable silence
- **WHEN** a task is Ready
- **THEN** the metadata line presents no actionability symbol or label at any viewport width

#### Scenario: Compress deadlines on mobile
- **WHEN** a mobile task row presents a Deadline
- **THEN** the flat metadata line presents the Deadline symbol, uses `Today` for a zero owner-planning calendar-day offset, and otherwise presents the signed offset followed by the correctly singular or plural `day` label, including `1 day`, `-1 day`, `4 days`, and `-4 days`

#### Scenario: Preserve complete desktop metadata
- **WHEN** the task row renders at or above the standard small breakpoint
- **THEN** Waiting, Rechecking, and Deadline metadata retain their complete established labels and relative-date phrasing while remaining visually flat

#### Scenario: Use quiet task summaries
- **WHEN** an active, Done, or Trash task row renders its Summary
- **THEN** the Summary uses the ordinary interface weight while retaining foreground contrast and the established Summary text size

#### Scenario: Use compact internal spacing
- **WHEN** a collapsed task row renders its Summary, optional metadata, checkbox, source, and actions
- **THEN** it uses compact horizontal and vertical spacing with a slightly reduced leading inset, keeps source and actions controls smaller than the row height and vertically centered, preserves mobile operability, and gives the Summary and metadata lines a small visible separation without clipping controls or text

#### Scenario: Present resting tasks without cards
- **WHEN** an active, Done, or Trash task is collapsed, resting, unfocused, and unselected
- **THEN** the task row has no visible border, background fill, rounded card boundary, shadow, or gap separating it from the next task row

#### Scenario: Highlight focused and selected tasks consistently
- **WHEN** a collapsed task has whole-task keyboard focus or is selected individually or for a bulk action
- **THEN** the task uses the established quiet selection background highlight without adding an outline or focus ring around the row

#### Scenario: Preserve expanded editing containment
- **WHEN** a user opens a task
- **THEN** the complete editor expands beneath the fixed-height row header inside one quiet rounded background with a subtly increased horizontal content inset that visibly contains the summary and editor without a resting border or shadow

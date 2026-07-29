## ADDED Requirements

### Requirement: Empty task drafts leave the list smoothly
Tasks SHALL animate the removal of a newly created task draft that remains empty when its editor closes, while preserving the rule that an empty draft is not retained.

#### Scenario: Close an empty new task
- **WHEN** a user closes a new task whose editable metadata and checklist contain no retained content
- **THEN** the row completes the standard task departure animation before disappearing from the visible list

#### Scenario: Respect reduced motion
- **WHEN** the user prefers reduced motion and closes an empty draft
- **THEN** the empty task is removed without a prolonged animation

### Requirement: Touch task rows expose directional swipe actions
On touch input, Tasks SHALL translate the swiped task row responsively, reveal a directional action icon in the exposed gap, invoke selection from a qualifying left swipe, and invoke the task's Start planning picker from a qualifying right swipe.

#### Scenario: Swipe left for selection
- **WHEN** a touch user drags a closed task row left beyond the qualifying horizontal threshold without the gesture becoming a vertical scroll
- **THEN** the row follows the gesture, reveals the selection affordance, returns to rest, and enters task selection mode with that task selected

#### Scenario: Swipe right for Start planning
- **WHEN** a touch user drags a closed task row right beyond the qualifying horizontal threshold without the gesture becoming a vertical scroll
- **THEN** the row follows the gesture, reveals the Start affordance, returns to rest, and opens the ordinary Start picker scoped to that task

#### Scenario: Cancel an incomplete swipe
- **WHEN** a touch gesture ends before either directional threshold or becomes predominantly vertical
- **THEN** the row returns to its resting position without invoking selection or planning

### Requirement: Summary supports forward cursor traversal into Notes
Tasks SHALL move editing focus from Summary to the start of Notes when the user presses unmodified Right Arrow with a collapsed selection at the end of Summary.

#### Scenario: Move from Summary to Notes
- **WHEN** Summary is editing, its selection is collapsed at the end of the value, and the user presses unmodified Right Arrow
- **THEN** Notes becomes focused with its insertion point at position zero

#### Scenario: Preserve ordinary Summary cursor movement
- **WHEN** Summary has a range selection, the insertion point is not at the end, composition is active, or a command modifier is held
- **THEN** Right Arrow retains its ordinary text-editing behavior

### Requirement: Task Primary Link actions use canonical external-link iconography
Tasks SHALL use the canonical generic external-link icon for Primary Link actions in task rows, the metadata editor, and the iOS widget unless the Primary Link uses a recognized protocol-specific icon.

#### Scenario: Show a generic Primary Link
- **WHEN** a task has a generic HTTP or HTTPS Primary Link
- **THEN** every actionable task-row, editor, and widget representation uses the canonical external-link icon

#### Scenario: Show a Mail message link
- **WHEN** a task Primary Link uses the recognized Mail message protocol
- **THEN** the task may retain the established Mail message icon rather than the generic external-link icon

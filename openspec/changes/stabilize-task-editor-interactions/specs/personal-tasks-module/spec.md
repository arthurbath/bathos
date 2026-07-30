## ADDED Requirements

### Requirement: Stable Open-Task Area Changes
The Tasks module SHALL preserve the active editor field and the open task's rendered placement while an Area command changes its Area.

#### Scenario: Preserve field focus
- **WHEN** the user invokes the Area command while a field in an open task is focused
- **THEN** the Area changes without moving keyboard focus or the text caret from that field

#### Scenario: Defer visible Area rebucketing
- **WHEN** an open task's Area changes on a list with visible Area buckets
- **THEN** the task remains in its current rendered bucket until the task closes

#### Scenario: Defer invisible automatic sorting
- **WHEN** an open task's metadata changes an invisible automatic-sort bucket
- **THEN** the task retains its rendered placement until the task closes

### Requirement: Editor-Owned Undo and Redo
Focused task-editing controls SHALL own undo and redo without also invoking the Tasks module's global history command.

#### Scenario: Undo inside a task field
- **WHEN** Summary, Notes, Primary Link, or a checklist item is focused and the user invokes undo
- **THEN** only that editor's content history changes and the global task undo action does not also run

#### Scenario: Redo inside a task field
- **WHEN** a task-editing control is focused and the user invokes redo
- **THEN** only that editor's content history changes and the global task redo action does not also run

#### Scenario: Undo outside an editor
- **WHEN** no editable task control is focused and the user invokes undo or redo
- **THEN** Tasks applies the corresponding persisted task-history action

### Requirement: Layered Task Escape
Escape SHALL dismiss exactly the deepest active task-editing layer.

#### Scenario: Close an inner surface first
- **WHEN** a picker, menu, popover, dialog, or checklist selection surface is active inside an open task and the user presses Escape
- **THEN** that inner surface closes or cancels while the task remains open

#### Scenario: Close the task next
- **WHEN** a task is open with no deeper surface owning Escape and the user presses Escape
- **THEN** the task closes and whole-task focus returns to its row

### Requirement: Contextual Floating Task Creation
The Tasks module SHALL fade and disable the floating task-creation action while any task metadata drawer is open.

#### Scenario: Hide creation while adding or editing
- **WHEN** a new or existing task's metadata drawer opens
- **THEN** the floating task-creation action fades out and cannot receive focus or activation

#### Scenario: Restore creation after editing
- **WHEN** the open task metadata drawer closes
- **THEN** the floating task-creation action fades back into view and becomes available again

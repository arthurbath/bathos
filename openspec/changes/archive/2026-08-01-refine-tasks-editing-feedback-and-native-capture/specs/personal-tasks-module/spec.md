## ADDED Requirements

### Requirement: Open task retains a summary-row drag handle
Tasks SHALL keep the ordinary rendered summary row visible while its metadata drawer is open and SHALL limit task-level drag initiation to that summary row.

#### Scenario: Reorder an open task from its summary
- **WHEN** a user presses and drags the rendered summary region of an open task
- **THEN** Tasks closes the metadata drawer as dragging begins and reorders the task among its eligible peers

#### Scenario: Edit Summary without initiating drag
- **WHEN** a user interacts with the Summary input inside the open metadata drawer
- **THEN** the input edits the task title normally and does not act as a task-level drag source

### Requirement: Modified-click selection starts from the clicked task
Tasks SHALL begin a new modified-click selection context from the task the user clicked rather than implicitly including a different open or keyboard-focused task.

#### Scenario: Command-click a different task
- **WHEN** selection mode is inactive and a user Command-clicks a task other than the currently open or keyboard-focused task
- **THEN** Tasks flushes and closes any open editor, clears the prior lightweight focus, enters selection mode, and selects only the clicked task

#### Scenario: Shift-click a different task before selection mode exists
- **WHEN** selection mode is inactive and a user Shift-clicks a task while a different task is open or keyboard-focused
- **THEN** Tasks closes and clears the prior task state, enters selection mode, and selects only the clicked task as the new range anchor

#### Scenario: Explicitly start selection from the current task
- **WHEN** a user invokes the documented Control+B current-task selection command
- **THEN** Tasks begins selection mode with the currently open or keyboard-focused task selected according to the existing command contract

### Requirement: Task history traversal provides immediate progress feedback
Tasks SHALL acknowledge every accepted undo or redo invocation immediately and SHALL prevent competing task interactions until the requested history traversal settles.

#### Scenario: Process undo
- **WHEN** a user invokes undo and Tasks begins resolving the history request
- **THEN** a centered spinner overlay appears immediately and remains until undo succeeds, reaches a neutral boundary, or fails

#### Scenario: Process redo
- **WHEN** a user invokes redo and Tasks begins resolving the history request
- **THEN** the same centered spinner overlay appears immediately, prevents duplicate traversal input, and clears when the request settles

### Requirement: Hide mobile navigation for software-keyboard editing
Tasks SHALL hide persistent mobile navigation while a software keyboard materially reduces the visual viewport around an editable control and SHALL otherwise preserve navigation in portrait and landscape layouts.

#### Scenario: Focus a field with the software keyboard visible
- **WHEN** a touch-device native or PWA Tasks surface focuses an editable field and its visual viewport contracts for the software keyboard
- **THEN** the mobile navigation is removed from view without shifting into the keyboard area

#### Scenario: Dismiss the software keyboard
- **WHEN** the editable focus or keyboard-induced viewport contraction ends
- **THEN** mobile navigation returns to its stable safe-area position

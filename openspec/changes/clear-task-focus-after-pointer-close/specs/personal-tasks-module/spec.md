## ADDED Requirements

### Requirement: Task editor closure focus follows interaction origin
The Tasks module SHALL distinguish pointer-triggered closure of an open task editor from keyboard-command closure so whole-task keyboard focus remains available only when the user closes through the keyboard interaction paradigm.

#### Scenario: Clear focus after pointer closure
- **WHEN** a user clicks or taps the summary row of its currently open ordinary task or recurrence prototype to close the editor
- **THEN** Tasks completes the ordinary autosave-aware close lifecycle, clears lightweight whole-task focus and its range anchor, and leaves no task-row-owned element with DOM focus

#### Scenario: Retain row focus after keyboard closure
- **WHEN** the Open/Close Task keyboard command closes an open ordinary task
- **THEN** Tasks completes the ordinary autosave-aware close lifecycle and returns whole-task keyboard focus to the freshly closed surviving summary row or the established same-position fallback

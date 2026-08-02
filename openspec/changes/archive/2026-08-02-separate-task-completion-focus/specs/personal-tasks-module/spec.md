## ADDED Requirements

### Requirement: Closed task completion preserves interaction-origin focus intent
Tasks SHALL distinguish pointer completion from keyboard completion when a closed task leaves an active list, without changing completion persistence, grace, animation, or error recovery.

#### Scenario: Complete a closed task by pointer
- **WHEN** a user clicks a closed task's completion checkbox
- **THEN** Tasks completes and removes that task without moving whole-task keyboard focus to another task

#### Scenario: Complete a closed task by keyboard shortcut
- **WHEN** a user invokes the task completion keyboard shortcut on a keyboard-focused closed task
- **THEN** Tasks completes and removes that task and moves whole-task keyboard focus to the next eligible task using the established list fallback order

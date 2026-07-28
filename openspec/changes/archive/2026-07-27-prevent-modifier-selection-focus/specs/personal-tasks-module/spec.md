## ADDED Requirements

### Requirement: Pointer Selection Focus Discipline
Tasks SHALL keep pointer-driven selection membership separate from keyboard task focus and SHALL not retain incidental DOM focus on a task summary control after a modified-click selection gesture.

#### Scenario: Clear focus after platform-modifier selection
- **WHEN** a user Command-clicks a task on Mac or Control-clicks a task on Windows to enter or alter selection mode
- **THEN** Tasks updates selection membership and its stable anchor without retaining DOM focus on the clicked summary control

#### Scenario: Clear focus after range selection
- **WHEN** a user Shift-clicks a task to establish or replace an anchored selection range
- **THEN** Tasks updates the selected range without retaining DOM focus on the clicked summary control

#### Scenario: Ignore a bare modifier after pointer selection
- **WHEN** pointer-driven selection is active and the user presses or releases Shift without another key
- **THEN** Tasks leaves selection unchanged and does not reveal keyboard focus on any task summary

#### Scenario: Preserve genuine keyboard focus
- **WHEN** a user intentionally navigates tasks through Space, arrow keys, Tab, or another declared keyboard traversal
- **THEN** Tasks continues to expose its ordinary accessible whole-task focus indication

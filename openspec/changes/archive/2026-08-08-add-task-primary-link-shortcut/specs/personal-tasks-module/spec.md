## ADDED Requirements

### Requirement: Direct Primary Link Keyboard Command
BathOS Tasks SHALL let a keyboard user activate the Primary Link of one open or whole-task-focused to-do through the platform-specific task command without changing the link or opening its editor field.

#### Scenario: Open a focused task Primary Link
- **WHEN** Control+J on Mac or Alt+Shift+J on Windows targets one open or whole-task-focused to-do with an actionable Primary Link
- **THEN** Tasks activates the same normalized destination, application handoff, and browser-context behavior as clicking that to-do's Primary Link control

#### Scenario: Ignore a missing Primary Link
- **WHEN** the Primary Link command has no singular ordinary task target or the target has no actionable Primary Link
- **THEN** Tasks performs no navigation, mutation, field disclosure, or notification

#### Scenario: Preserve the Link editing command
- **WHEN** the user invokes Control+H on Mac or Alt+Shift+H on Windows
- **THEN** Tasks retains the existing Add or Focus Link behavior and does not activate the Primary Link destination

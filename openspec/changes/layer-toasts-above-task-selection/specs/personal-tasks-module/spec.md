## ADDED Requirements

### Requirement: Task selection controls yield to notifications
The Tasks selection-mode bar SHALL remain visually beneath shared BathOS toast notifications while staying fixed above ordinary task-list content.

#### Scenario: Receive a toast during task selection
- **WHEN** selection mode is active and BathOS displays a toast notification
- **THEN** the toast is fully visible above the fixed selection-mode bar
- **AND** the selection controls remain available after the toast dismisses

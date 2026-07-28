## ADDED Requirements

### Requirement: Task Drag Preview
Tasks SHALL keep task-list placement feedback anchored to the list and SHALL NOT include a task drop-position indicator in the native drag preview that follows the pointer.

#### Scenario: Drag a task while a placement marker is available
- **WHEN** a user begins dragging a task whose list can render a blue drop-position indicator
- **THEN** the native drag preview contains the task's summary content without the blue indicator while the list remains free to show the indicator at the current legal drop position

#### Scenario: Preserve native drag fallback
- **WHEN** the active browser does not expose a programmable native drag-image API
- **THEN** Tasks continues the native task drag without blocking reordering or changing persisted task data

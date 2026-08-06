## ADDED Requirements

### Requirement: Shared tab triggers are centered within standard-height tab lists
BathOS SHALL render shared high-resolution tab lists at the standard single-line input height and SHALL constrain each tab trigger and its active rectangle to the list's available inner height so the trigger is vertically centered with even top and bottom spacing.

#### Scenario: Render a shared tab list
- **WHEN** a BathOS surface renders the shared Tabs primitive with its default sizing
- **THEN** the tab list matches the standard single-line input height
- **AND** every trigger fills, but does not exceed, the list's inner height
- **AND** the trigger label and active rectangle are vertically centered within the list

#### Scenario: Change the active tab
- **WHEN** the user activates a different shared tab
- **THEN** the active fill moves to the selected trigger without changing the list height or the trigger's vertical alignment

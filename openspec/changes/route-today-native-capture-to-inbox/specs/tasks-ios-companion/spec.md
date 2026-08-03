## ADDED Requirements

### Requirement: Today native add surfaces use Inbox placement
The iOS Tasks companion SHALL route both the Control Center New Task action and the Today large-widget plus action to the authoritative Today new-task editor with Inbox horizon placement.

#### Scenario: Add from Control Center
- **WHEN** the user invokes the iOS Control Center New Task action
- **THEN** Tasks opens the Today list and begins one new task in the Inbox horizon

#### Scenario: Add from the Today widget
- **WHEN** the user activates the plus action on the Today large widget
- **THEN** Tasks opens the Today list and begins one new task in the Inbox horizon

#### Scenario: Preserve other widget destinations
- **WHEN** the user activates the plus action on an Upcoming, Anytime, or Someday large widget
- **THEN** Tasks opens the configured list and applies that list's established native creation placement

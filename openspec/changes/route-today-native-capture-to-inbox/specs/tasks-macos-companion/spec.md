## ADDED Requirements

### Requirement: macOS Today widget add uses Inbox placement
The macOS Tasks companion SHALL route the Today large-widget plus action to the authoritative Today new-task editor with Inbox horizon placement while retaining configured-list creation for the other supported widget lists.

#### Scenario: Add from the Today widget
- **WHEN** the user activates the plus action on the macOS Today large widget
- **THEN** Tasks opens the Today list and begins one new task in the Inbox horizon

#### Scenario: Preserve other widget destinations
- **WHEN** the user activates the plus action on an Upcoming, Anytime, or Someday macOS large widget
- **THEN** Tasks opens the configured list and applies that list's established native creation placement

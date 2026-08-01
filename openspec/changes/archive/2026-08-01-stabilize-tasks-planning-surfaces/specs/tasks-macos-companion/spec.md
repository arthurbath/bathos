## ADDED Requirements

### Requirement: macOS Upcoming Widget Rank
The macOS widget SHALL use the same authoritative Upcoming rank as the web list before truncating its projection.

#### Scenario: Render more than ten Upcoming rows
- **WHEN** Upcoming contains ordinary tasks and recurrence prototypes sharing controlling dates
- **THEN** the widget displays the first ten rows in controlling-date and Upcoming-rank order

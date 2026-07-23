## ADDED Requirements

### Requirement: Chronological Upcoming Presentation
The system SHALL present the complete Upcoming view from the nearest controlling date to the latest controlling date, regardless of whether each dated item is a project or a to-do.

#### Scenario: Interleave projects and to-dos chronologically
- **WHEN** Upcoming contains projects and to-dos with different controlling dates
- **THEN** the interface orders every item by controlling date from nearest to latest instead of rendering one entity type before the other

#### Scenario: Order exact dates inside broader groups
- **WHEN** multiple Upcoming items fall within the same month or year group
- **THEN** the interface orders those items by their exact controlling dates from nearest to latest

#### Scenario: Preserve deterministic equal-date order
- **WHEN** multiple Upcoming items share the same controlling date
- **THEN** the interface uses stable type-specific ordering without moving any later-dated item above an earlier-dated item

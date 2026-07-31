## ADDED Requirements

### Requirement: Decorated date fields share standard control spacing
The shared date-picker field SHALL place its optional leading decoration and visible content using the same spacing token as the shared single-select trigger, without applying a second component-specific margin.

#### Scenario: Decorated date field renders
- **WHEN** a date-picker field renders with a leading decoration
- **THEN** the trigger SHALL contain exactly the shared control gap between the decoration and visible value or placeholder
- **AND** the trailing calendar affordance SHALL remain pinned and non-colliding

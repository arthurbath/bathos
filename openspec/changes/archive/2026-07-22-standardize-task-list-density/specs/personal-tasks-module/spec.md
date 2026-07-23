## ADDED Requirements

### Requirement: Consistent Tasks list density
The interface SHALL present count-bearing Tasks list and grouping headings with compact numeric badges and SHALL keep every collapsed to-do row at a uniform height independent of its secondary metadata.

#### Scenario: Present grouping totals as badges
- **WHEN** a Tasks list or grouping heading includes an item total
- **THEN** the interface presents the total in an adjacent neutral badge rather than embedding it in parenthetical heading text

#### Scenario: Keep closed rows uniform
- **WHEN** a list contains collapsed to-dos with different combinations of hierarchy, actionability, scheduling, deadline, reminder, or other secondary details
- **THEN** every collapsed to-do row occupies the same height

#### Scenario: Bound secondary metadata
- **WHEN** a collapsed to-do has one or more secondary details
- **THEN** the interface presents those details in one bounded nonwrapping metadata line without increasing the row height

#### Scenario: Preserve expanded editing
- **WHEN** a user opens a to-do
- **THEN** the complete editor expands beneath the fixed-height row header without clipping the editor content

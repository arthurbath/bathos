## MODIFIED Requirements

### Requirement: Consistent Tasks list density
The interface SHALL present count-bearing Tasks list and grouping headings with compact numeric badges, SHALL keep every collapsed to-do at a dense uniform height, and SHALL bound primary planning items with subtle individual rounded rectangles.

#### Scenario: Present grouping totals as badges
- **WHEN** a Tasks list or grouping heading includes an item total
- **THEN** the interface presents the total in an adjacent neutral badge rather than embedding it in parenthetical heading text

#### Scenario: Keep closed rows uniform
- **WHEN** a list contains collapsed to-dos with different combinations of hierarchy, actionability, scheduling, deadline, reminder, or other secondary details
- **THEN** every collapsed to-do row occupies the same 56-pixel height

#### Scenario: Bound secondary metadata
- **WHEN** a collapsed to-do has one or more secondary details
- **THEN** the interface presents those details in one bounded nonwrapping metadata line without increasing the row height

#### Scenario: Use compact internal spacing
- **WHEN** a collapsed to-do row renders its title, optional metadata, checkbox, source, and actions
- **THEN** it uses compact horizontal padding and gaps and gives the title and metadata lines a small visible separation without clipping controls or text

#### Scenario: Bound planning items individually
- **WHEN** a primary Today, Upcoming, Anytime, or Someday planning list renders adjacent active to-dos or planning projects
- **THEN** each item appears inside its own rounded rectangle with a quiet semantic border, a barely differentiated dark surface, no shadow, and a very small gap before the next item

#### Scenario: Preserve interactive card states
- **WHEN** a planning item is selected, bulk-selected, focused, dragged, terminally transitioning, or expanded
- **THEN** its interaction treatment remains visible and contained within the same rounded boundary

#### Scenario: Preserve expanded editing
- **WHEN** a user opens a to-do
- **THEN** the complete editor expands inside the selected rectangle beneath the fixed-height row header without clipping the editor content

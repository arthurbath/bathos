## MODIFIED Requirements

### Requirement: Consistent Tasks list density
The interface SHALL present Tasks list and grouping headings without item-count adornments, SHALL keep every collapsed task at a dense uniform height, and SHALL use alignment rather than resting card decoration to associate each task's primary and secondary content.

#### Scenario: Present count-free headings
- **WHEN** a Tasks list, section, grouping, search-results, project, area, or checklist heading is presented
- **THEN** the interface presents its descriptive label without a visible or programmatic numeric item count

#### Scenario: Keep closed rows uniform
- **WHEN** a list contains collapsed tasks with different combinations of hierarchy, actionability, scheduling, deadline, reminder, or other secondary details
- **THEN** every collapsed task row occupies the same 44-pixel height

#### Scenario: Keep secondary details compact
- **WHEN** a collapsed task has one or more secondary details
- **THEN** the interface presents those details in one bounded nonwrapping metadata line without increasing the row height

#### Scenario: Use compact internal spacing
- **WHEN** a collapsed task row renders its title, optional metadata, checkbox, source, and actions
- **THEN** it uses compact matched horizontal and vertical spacing, preserves usable control targets, and gives the title and metadata lines a small visible separation without clipping controls or text

#### Scenario: Present resting tasks without cards
- **WHEN** an active, Done, or Trash task is collapsed, resting, unfocused, and unselected
- **THEN** the task row has no visible border, background fill, rounded card boundary, shadow, or gap separating it from the next task row

#### Scenario: Highlight focused and selected tasks consistently
- **WHEN** a collapsed task has whole-task keyboard focus or is selected individually or for a bulk action
- **THEN** the task uses the established quiet selection background highlight without adding an outline or focus ring around the row

#### Scenario: Preserve expanded editing containment
- **WHEN** a user opens a task
- **THEN** the complete editor expands beneath the fixed-height row header inside one quiet rounded background that visibly contains the summary and editor without a resting border or shadow

#### Scenario: Preserve planning-project cards
- **WHEN** a primary planning view presents project navigation items alongside compact task rows
- **THEN** the project items retain their distinct card presentation and spacing

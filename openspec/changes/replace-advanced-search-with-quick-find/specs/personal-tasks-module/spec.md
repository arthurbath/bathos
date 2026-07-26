## MODIFIED Requirements

### Requirement: Global Task Quick Find
The system SHALL provide Quick Find as the primary Tasks search entry point across to-dos, projects, and areas and SHALL retain a live full task-results route for exhaustive continuation.

#### Scenario: Open Quick Find from persistent search
- **WHEN** a user activates the persistent magnifying-glass search action on any Tasks route
- **THEN** Tasks opens Quick Find rather than an advanced filter dialog

#### Scenario: Open Quick Find by typing
- **WHEN** a user presses one nonrepeated printable character from an eligible non-editable Tasks surface without Command, Control, or Alt held
- **THEN** Tasks opens Quick Find, places focus in its query input, and initializes the query with the exact typed character

#### Scenario: Permit shifted printable input
- **WHEN** Shift is the only modifier held while type-to-search receives a printable character
- **THEN** Quick Find opens with the resulting uppercase letter or shifted punctuation unchanged

#### Scenario: Support every Tasks route
- **WHEN** type-to-search is invoked from a planning list, Done, Search, Projects, Templates, an area, a project, or Config
- **THEN** the same Quick Find surface opens over the current Tasks runtime

#### Scenario: Preserve owned keyboard input
- **WHEN** a printable key belongs to an input, textarea, select, contenteditable region, active composition, dialog, menu, listbox, popover, or another nested interaction surface
- **THEN** Tasks leaves the key with that surface and does not open or reseed Quick Find

#### Scenario: Show the best quick matches
- **WHEN** a user types a substring in Quick Find
- **THEN** the surface updates with each keystroke and presents at most three matching to-do, project, or area results with their entity types

#### Scenario: Close Quick Find
- **WHEN** Quick Find is visible and the user presses Escape
- **THEN** the surface closes without changing task data

#### Scenario: Continue a search
- **WHEN** the user activates Continue Search
- **THEN** the module navigates through a real in-app link to `/tasks/search` with the current query and lists every matching to-do from every planning and lifecycle view

#### Scenario: Refine full results
- **WHEN** the user edits the query on the search-results page
- **THEN** the URL query and full to-do results update with each keystroke

#### Scenario: Open a hierarchy result
- **WHEN** the user activates a project or area Quick Find result
- **THEN** a real in-app link opens that hierarchy record and preserves modified-click behavior

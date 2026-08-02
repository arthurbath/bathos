## MODIFIED Requirements

### Requirement: Global Task Quick Find
The system SHALL provide typing-only Quick Find as the primary Tasks search entry point across to-dos, SHALL omit visible Quick Find trigger controls from Tasks routes, and SHALL retain a live full task-results route for exhaustive continuation.

#### Scenario: Omit visible Quick Find controls
- **WHEN** a user visits a Tasks list, Config, or another Tasks route
- **THEN** the persistent header exposes no magnifying-glass or other clickable Quick Find trigger

#### Scenario: Open Quick Find by typing
- **WHEN** a user presses one nonrepeated printable character from an eligible non-editable Tasks surface without Command, Control, or Alt held
- **THEN** Tasks opens a compact centered Quick Find palette, places focus in its query input, and initializes the query with the exact typed character

#### Scenario: Permit shifted printable input
- **WHEN** Shift is the only modifier held while type-to-search receives a printable character
- **THEN** Quick Find opens with the resulting uppercase letter or shifted punctuation unchanged

#### Scenario: Preserve owned keyboard input
- **WHEN** a printable key belongs to an input, textarea, select, contenteditable region, active composition, dialog, menu, listbox, popover, or another nested interaction surface
- **THEN** Tasks leaves the key with that surface and does not open or reseed Quick Find

#### Scenario: Present compact results
- **WHEN** Quick Find has a nonblank query
- **THEN** the palette shows at most three matching open, non-trashed to-dos without task checkboxes, row borders, a visible title, or a visible close control

#### Scenario: Exclude Done tasks from compact results
- **WHEN** a Quick Find query matches a completed, canceled, or trashed to-do
- **THEN** Quick Find omits that to-do from its compact result rows
- **AND** the exhaustive Search route continues to include the matching to-do

#### Scenario: Offer exhaustive results conditionally
- **WHEN** the full Search page would return at least one result for the current query
- **THEN** Quick Find shows `See All Results` after its compact results
- **WHEN** the full Search page would return no result
- **THEN** Quick Find omits `See All Results`

#### Scenario: Match a Primary Link
- **WHEN** a nonblank Quick Find query occurs within a to-do's Primary Link value
- **THEN** Quick Find and the exhaustive Search route include that to-do among the matching results

#### Scenario: Prioritize summary matches
- **WHEN** a query matches one to-do's Summary and only ancillary metadata such as Primary Link, Notes, source details, or Area on other to-dos
- **THEN** Quick Find ranks the Summary match ahead of every ancillary-metadata match

#### Scenario: Distinguish a recurrence definition
- **WHEN** a Quick Find result represents the Upcoming recurrence definition rather than a materialized task instance
- **THEN** the result is prefixed by the established repeat icon

#### Scenario: Navigate preliminary selection
- **WHEN** the query input owns DOM and text-cursor focus and the user presses Up or Down
- **THEN** Quick Find keeps text focus in the input while moving one visible preliminary selection through the results and the conditional See All Results action

#### Scenario: Activate preliminary selection
- **WHEN** a preliminary selection is visible and the user presses Return
- **THEN** Quick Find activates that result or See All Results without requiring pointer input

#### Scenario: Close Quick Find with Escape
- **WHEN** Quick Find is visible and the user presses Escape
- **THEN** the surface closes without changing task data

#### Scenario: Consume an outside dismissal
- **WHEN** the user presses outside the Quick Find palette
- **THEN** Quick Find closes and the same pointer action does not activate the underlying Tasks interface

#### Scenario: Open a regular task result
- **WHEN** the user activates a non-recurrence-definition task result
- **THEN** Tasks navigates to the task's natural planning or history list, opens the task, and smoothly aligns its expanded summary row as close to the top of the visible content as available scroll depth permits

#### Scenario: Focus a recurrence-definition result
- **WHEN** the user activates an Upcoming recurrence-definition result
- **THEN** Tasks navigates to Upcoming, keeps recurrence management closed, smoothly reveals the recurrence row, and applies whole-row keyboard focus

#### Scenario: See all results
- **WHEN** the user activates See All Results
- **THEN** the module navigates through a real in-app link to `/tasks/search` with the current query and lists every matching task from every planning and lifecycle view

#### Scenario: Refine full results
- **WHEN** the user edits the query on the search-results page
- **THEN** the URL query and full task results update with each keystroke

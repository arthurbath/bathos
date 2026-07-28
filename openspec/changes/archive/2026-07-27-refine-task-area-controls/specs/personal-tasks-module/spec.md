## MODIFIED Requirements

### Requirement: Compact Task Date Controls
The Tasks expanded task editor SHALL present Start and Deadline as a matched two-column pair and SHALL present Actionability beside Area only when at least one Area exists, while retaining each field's independent autosave semantics.

#### Scenario: Present Start and Deadline together
- **WHEN** an expanded task editor renders at a supported desktop or mobile viewport width
- **THEN** Start and Deadline appear on the same row with equal-width triggers, the same ordinary task-input text size, and the same muted right-aligned calendar symbol

#### Scenario: Present Actionability and Area together
- **WHEN** an expanded task editor renders at a supported desktop or mobile viewport width for an owner with at least one Area
- **THEN** Actionability and Area appear on the same row with equal-width triggers and one-line values that truncate rather than expanding the grid

#### Scenario: Omit Area when no Areas exist
- **WHEN** an expanded task editor renders for an owner with no defined Areas
- **THEN** the Area selector is absent and Actionability occupies the full row width

#### Scenario: Clear Deadline inside its picker
- **WHEN** a task has a Deadline and the user activates Clear inside the Deadline picker
- **THEN** Tasks immediately persists a null Deadline, closes the picker, restores trigger focus, and exposes no separate inline clear button

#### Scenario: Leave the Deadline calendar through its lower boundary
- **WHEN** keyboard focus is on the final visible row of the Deadline calendar and the user presses ArrowDown
- **THEN** focus moves to Clear and the visible calendar month does not change

#### Scenario: Identify today in either calendar
- **WHEN** the owner planning date is visible in the Start or Deadline day calendar or its month picker
- **THEN** the shared Calendar replaces today's in-month numeric day label with Lucide's Star icon, places the same icon to the right of the current month name, preserves accessible current-date and month names, and retains selected-value highlighting independently

### Requirement: Global Task Quick Find
The system SHALL provide typing-only Quick Find as the primary Tasks search entry point across tasks and Areas, SHALL omit visible Quick Find trigger controls from Tasks routes, and SHALL retain a live full task-results route for exhaustive continuation.

#### Scenario: Omit visible Quick Find controls
- **WHEN** a user visits a Tasks list, Config, or another Tasks route
- **THEN** the persistent header exposes no magnifying-glass or other clickable Quick Find trigger

#### Scenario: Open Quick Find by typing
- **WHEN** a user presses one nonrepeated printable character from an eligible non-editable Tasks surface without Command, Control, or Alt held
- **THEN** Tasks opens Quick Find, places focus in its query input, and initializes the query with the exact typed character

#### Scenario: Permit shifted printable input
- **WHEN** Shift is the only modifier held while type-to-search receives a printable character
- **THEN** Quick Find opens with the resulting uppercase letter or shifted punctuation unchanged

#### Scenario: Preserve owned keyboard input
- **WHEN** a printable key belongs to an input, textarea, select, contenteditable region, active composition, dialog, menu, listbox, popover, or another nested interaction surface
- **THEN** Tasks leaves the key with that surface and does not open or reseed Quick Find

#### Scenario: Close Quick Find
- **WHEN** Quick Find is visible and the user presses Escape
- **THEN** the surface closes without changing task data

#### Scenario: Continue a search
- **WHEN** the user activates Continue Search
- **THEN** the module navigates through a real in-app link to `/tasks/search` with the current query and lists every matching task from every planning and lifecycle view

#### Scenario: Refine full results
- **WHEN** the user edits the query on the search-results page
- **THEN** the URL query and full task results update with each keystroke

### Requirement: Area-Aware Task Planning
The Tasks module SHALL use name-only Areas to organize ongoing responsibilities through direct optional task assignment, SHALL keep Area organization separate from temporal planning, and SHALL present Area choices without obsolete Project-era grouping.

#### Scenario: Keep Areas name-only
- **WHEN** a user creates or edits an Area
- **THEN** the Area exposes a name and manual order without completion, Start, Deadline, destination, or day-horizon state

#### Scenario: Leave Today work intermingled
- **WHEN** Today contains tasks from different Areas and tasks with no Area
- **THEN** the user can order them together inside one day horizon without an Area bucket changing membership or rank

#### Scenario: Order Area buckets manually
- **WHEN** multiple Area buckets contain visible Anytime tasks
- **THEN** the interface orders the buckets by the manual Area order maintained in Config, after the unlabelled unassigned region

#### Scenario: Omit an empty Area bucket
- **WHEN** an Area has no task visible under ordinary Anytime membership and the active Quick Filter
- **THEN** Anytime omits that Area's heading and does not render an empty bucket

#### Scenario: Create inside an Area bucket
- **WHEN** a user activates an Area bucket heading in Anytime or Someday
- **THEN** Tasks opens one new task in that view assigned directly to that Area at the top of the bucket

#### Scenario: Create generic Anytime work
- **WHEN** a user activates the floating New Task action in Anytime
- **THEN** Tasks opens one unassigned Anytime task at the top of the unlabelled region

#### Scenario: Present Area choices directly
- **WHEN** the expanded task editor presents an Area selector
- **THEN** its choices are No Area followed by the owner's ordered Areas without an Areas section heading

#### Scenario: Manage Areas in Config
- **WHEN** a user opens Tasks Config
- **THEN** one Areas card DataGrid allows the user to add Areas, edit names in its single Name column, and use each row's ellipsis menu to move or recoverably delete the Area when those actions are eligible

#### Scenario: Return from an Area detail
- **WHEN** an Area detail presents a return breadcrumb
- **THEN** the breadcrumb returns to Config and Area renaming remains available only in Config

## ADDED Requirements

### Requirement: Cyclic Task Area Command
BathOS Tasks SHALL let the platform-specific Control+V task command cycle Area assignment for one or more eligible task targets without opening an Area selector.

#### Scenario: Cycle one task through Areas
- **WHEN** Control+V on Mac or Alt+Shift+V on Windows targets one eligible task
- **THEN** Tasks advances the task through No Area and each owner Area in configured order, wraps after the final Area, and preserves unrelated metadata

#### Scenario: Normalize a mixed bulk selection
- **WHEN** the Area command targets multiple tasks whose Area values differ
- **THEN** Tasks first assigns every target to No Area

#### Scenario: Advance a unified bulk selection
- **WHEN** the Area command targets multiple tasks that all share No Area or the same Area
- **THEN** Tasks advances every target together to the next value in the ordered Area cycle

#### Scenario: Cycle with no defined Areas
- **WHEN** the Area command targets tasks while the owner has no defined Areas
- **THEN** Tasks performs no mutation because No Area is the only available value

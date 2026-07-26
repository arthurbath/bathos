## MODIFIED Requirements

### Requirement: Compact Task Date Controls
The Tasks expanded task editor SHALL present Start and Deadline as a matched two-column pair and Actionability and Organization as a second matched two-column pair at every supported viewport width while retaining each field's independent autosave semantics.

#### Scenario: Present Start and Deadline together
- **WHEN** an expanded task editor renders at a supported desktop or mobile viewport width
- **THEN** Start and Deadline appear on the same row with equal-width triggers, the same ordinary task-input text size, and the same muted right-aligned calendar symbol

#### Scenario: Present Actionability and Organization together
- **WHEN** an expanded task editor renders at a supported desktop or mobile viewport width
- **THEN** Actionability and Organization appear on the same row with equal-width triggers and one-line values that truncate rather than expanding the grid

#### Scenario: Clear Deadline inside its picker
- **WHEN** a task has a Deadline and the user activates Clear inside the Deadline picker
- **THEN** Tasks immediately persists a null Deadline, closes the picker, restores trigger focus, and exposes no separate inline clear button

#### Scenario: Leave the Deadline calendar through its lower boundary
- **WHEN** keyboard focus is on the final visible row of the Deadline calendar and the user presses ArrowDown
- **THEN** focus moves to Clear and the visible calendar month does not change

#### Scenario: Identify today in either calendar
- **WHEN** the owner planning date is visible in the Start or Deadline day calendar or its month picker
- **THEN** the shared Calendar replaces today's in-month numeric day label with Lucide's Star icon, places the same icon to the right of the current month name, preserves accessible current-date and month names, and retains selected-value highlighting independently

### Requirement: Consistent Tasks list density
The interface SHALL present Tasks list and grouping headings without item-count adornments, SHALL keep every collapsed task at a dense uniform height, and SHALL use alignment and ordinary-weight titles rather than resting card decoration or bold typography to associate each task's primary and secondary content.

#### Scenario: Present count-free headings
- **WHEN** a Tasks list, section, grouping, search-results, project, area, or checklist heading is presented
- **THEN** the interface presents its descriptive label without a visible or programmatic numeric item count

#### Scenario: Keep closed rows uniform
- **WHEN** a list contains collapsed tasks with different combinations of hierarchy, actionability, scheduling, deadline, reminder, or other secondary details
- **THEN** every collapsed task row occupies the same 44-pixel height

#### Scenario: Keep secondary details compact
- **WHEN** a collapsed task has one or more secondary details
- **THEN** the interface presents those details in one bounded nonwrapping metadata line without increasing the row height

#### Scenario: Use quiet task titles
- **WHEN** an active, Done, or Trash task row renders its title
- **THEN** the title uses the ordinary interface weight while retaining foreground contrast and the established task-title size

#### Scenario: Use compact internal spacing
- **WHEN** a collapsed task row renders its title, optional metadata, checkbox, source, and actions
- **THEN** it uses compact matched horizontal and vertical spacing, keeps source and actions controls smaller than the row height and vertically centered, preserves mobile operability, and gives the title and metadata lines a small visible separation without clipping controls or text

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

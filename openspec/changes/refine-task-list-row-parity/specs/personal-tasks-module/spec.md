## MODIFIED Requirements

### Requirement: Task summary metadata
The Tasks module SHALL present compact secondary metadata relevant to the current list context and SHALL omit metadata already communicated by the visible containing bucket.

#### Scenario: Omit redundant Someday Area metadata
- **WHEN** a task appears inside a visible Area bucket on Someday
- **THEN** its secondary metadata omits that same Area label while preserving all other applicable metadata

### Requirement: Task bulk selection
The Tasks module SHALL expose only bulk actions valid for every selected entity and SHALL include Today horizon assignment only on Today.

#### Scenario: Assign a Today horizon in bulk
- **WHEN** one or more ordinary tasks are selected on Today and the user opens Edit
- **THEN** the first-level menu includes Horizon and its submenu presents Inbox, Now, Next, and Later with their canonical colored icons
- **AND** choosing one assigns that horizon to every selected task without changing its Start date

#### Scenario: Omit Horizon outside Today
- **WHEN** selection mode is active on Upcoming, Anytime, Someday, or Done
- **THEN** the bulk Edit menu does not offer Horizon

### Requirement: Primary Link activation
Tasks SHALL keep every actionable Primary Link as a real destination and SHALL not lose its activation when another task editor must close.

#### Scenario: Activate another task's Primary Link
- **WHEN** one task editor is open and the user ordinarily activates a Primary Link on a different task row
- **THEN** Tasks preserves native activation of the real Primary Link and requests that the open editor close without canceling or delaying the destination

#### Scenario: Preserve modified link activation
- **WHEN** the user activates a Primary Link with a browser-supported modified click
- **THEN** the browser handles the real anchor directly without Tasks canceling or delaying the destination

### Requirement: Upcoming keyboard traversal
Tasks SHALL treat dated recurrence prototypes and ordinary tasks as one rendered keyboard-navigation sequence in Upcoming.

#### Scenario: Traverse a recurrence prototype
- **WHEN** focus movement by Up Arrow, Down Arrow, Space, or Shift+Space reaches a dated recurrence prototype
- **THEN** the prototype receives the sole whole-row keyboard-focus highlight

#### Scenario: Open a focused recurrence prototype
- **WHEN** a dated recurrence prototype has whole-row keyboard focus and the user presses Return
- **THEN** Tasks opens that prototype's ordinary metadata drawer

### Requirement: Checklist horizontal boundary traversal
The system SHALL treat adjacent checklist-item inputs as continuous lines for plain, macOS Option-modified, and macOS Command-modified horizontal caret movement while preserving native text-input and browser behavior away from eligible item boundaries.

#### Scenario: Move left into the preceding checklist item
- **WHEN** a checklist-item input has a collapsed caret at the beginning, an adjacent preceding item exists, and a Mac user presses Left Arrow with no modifier, Option only, or Command only
- **THEN** Tasks focuses the preceding checklist input and places the caret at the end of its value

#### Scenario: Move right into the following checklist item
- **WHEN** a checklist-item input has a collapsed caret at the end, an adjacent following item exists, and a Mac user presses Right Arrow with no modifier, Option only, or Command only
- **THEN** Tasks focuses the following checklist input and places the caret at the beginning of its value

#### Scenario: Preserve native horizontal behavior elsewhere
- **WHEN** the caret or selection is not at an eligible boundary, the platform is not Mac-like, or another modifier combination is used
- **THEN** Tasks leaves the event to native input or browser behavior

### Requirement: Task and checklist drag handles
Tasks SHALL expose compact task-row drag handles automatically on touch-capable surfaces, omit them from point-and-click task rows, and always expose a dedicated checklist-item drag handle.

#### Scenario: Present a task handle on touch
- **WHEN** an eligible task or recurrence row is rendered on a touch-capable surface
- **THEN** its trailing controls include an immediate drag handle

#### Scenario: Omit a task handle on point-and-click
- **WHEN** the same row is rendered on a surface without touch capability
- **THEN** no dedicated task drag handle appears and the ordinary summary-row drag path remains available

#### Scenario: Edit checklist text
- **WHEN** a user presses and drags inside a checklist text input
- **THEN** the browser owns text selection and no checklist reorder begins

#### Scenario: Reorder a checklist item
- **WHEN** a user drags the checklist item's permanently visible handle
- **THEN** Tasks reorders the item through the existing checklist-owned drop behavior

#### Scenario: Omit drag-handle configuration
- **WHEN** the user opens Tasks Features settings
- **THEN** no Drag Handles preference is presented because handle visibility follows the surface contract

### Requirement: Task list edge alignment
Tasks SHALL align resting task-row content with the horizontal edges of the surrounding list content while retaining protective padding inside highlighted task surfaces and metadata drawers.

#### Scenario: Render a task list
- **WHEN** ordinary tasks or recurrence prototypes appear in a planning stack
- **THEN** the stack compensates for row inset on both inline edges without producing horizontal page overflow

#### Scenario: Render an expanded metadata drawer
- **WHEN** a task drawer appears at any supported viewport width
- **THEN** it retains 0.875rem inline padding and its checklist completion controls align with the other drawer fields

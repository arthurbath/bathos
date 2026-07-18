## ADDED Requirements

### Requirement: Longtext DataGrid cells expose a full-content viewer
The system SHALL allow a DataGrid text field to be explicitly designated as longtext. A designated longtext cell SHALL retain inline text editing and SHALL display a magnifying-glass action to the right of its input that opens a read-only modal containing the cell's complete current value.

#### Scenario: Read a long value
- **WHEN** a user activates the magnifying-glass action for a populated longtext cell
- **THEN** the system opens a modal with the field title and the complete value, preserving line breaks and wrapping long lines

#### Scenario: Read an empty value
- **WHEN** a user activates the magnifying-glass action for an empty longtext cell
- **THEN** the system opens the modal and displays the shared null placeholder

#### Scenario: Viewer has no footer
- **WHEN** the longtext modal is open
- **THEN** the modal contains only its header and read-only content body, and the body reaches the rounded bottom edge without a footer chin or bottom divider

#### Scenario: Viewer body has balanced vertical padding
- **WHEN** the longtext modal is open
- **THEN** the read-only content body uses equal top and bottom padding

#### Scenario: Edit a longtext value inline
- **WHEN** a user edits and commits a designated longtext cell
- **THEN** the system uses the same save, history, focus-restoration, and optimistic display behavior as a standard editable text cell

### Requirement: Longtext viewer action is keyboard accessible
The magnifying-glass action SHALL have an accessible name, participate in DataGrid keyboard traversal, open from keyboard activation, and return focus through the shared modal focus behavior when closed.

#### Scenario: Open the viewer by keyboard
- **WHEN** keyboard focus is on the magnifying-glass action and the user presses Enter or Space
- **THEN** the system opens the longtext modal without entering text-edit mode

### Requirement: Garage Services and Servicings Notes use longtext behavior
The Garage Services and Servicings DataGrids SHALL designate their Notes columns as longtext.

#### Scenario: Inspect Garage service notes
- **WHEN** a user views a Garage service row
- **THEN** the Notes cell provides inline editing and the magnifying-glass action for reading the complete note

#### Scenario: Inspect Garage servicing notes
- **WHEN** a user views a Garage servicing row
- **THEN** the Notes cell provides inline editing and the magnifying-glass action for reading the complete note

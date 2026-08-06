## MODIFIED Requirements

### Requirement: DataGrid text-entry cells separate focus and editing

Text, number, currency, percentage, URL, email, password, and time-entry cells inside DataGrids SHALL have a focused non-editing state distinct from active text editing. Keyboard navigation SHALL focus a cell without showing a text caret, while pointer activation SHALL enter editing at the pointer-selected insertion point. A focused non-editing text-entry cell SHALL accept a platform paste action as a spreadsheet-style complete-value replacement, commit that replacement through the cell's normal save path, and remain focused without entering editing mode.

#### Scenario: Keyboard navigation focuses without editing

- **WHEN** keyboard navigation moves focus onto a text-entry grid cell
- **THEN** the cell SHALL receive focus in a non-editing state
- **AND** the cell SHALL NOT show an active insertion caret

#### Scenario: Pointer activation edits at the chosen insertion point

- **WHEN** the user clicks or taps inside a text-entry grid cell
- **THEN** the cell SHALL enter editing mode
- **AND** the caret SHALL be placed at the insertion point chosen by the pointer interaction

#### Scenario: Return enters editing at the end

- **WHEN** a text-entry grid cell is focused but not editing and the user presses `Return`
- **THEN** the cell SHALL enter editing mode
- **AND** the caret SHALL be placed at the end of the current value

#### Scenario: Printable input replaces the focused value

- **WHEN** a text-entry grid cell is focused but not editing and the user types a printable character
- **THEN** the cell SHALL replace its complete current value with that character
- **AND** the cell SHALL enter editing mode with the caret after the replacement character

#### Scenario: Paste replaces and commits the focused value

- **WHEN** an enabled text-entry grid cell is focused but not editing and the user invokes the platform paste action
- **THEN** the cell SHALL replace its complete current value with the clipboard's plain-text content
- **AND** the replacement SHALL pass through the cell's normal normalization, validation, history, optimistic-save, and rollback behavior
- **AND** the cell SHALL remain keyboard-focused in the non-editing state

#### Scenario: Paste remains native while editing

- **WHEN** a text-entry grid cell is actively editing and the user invokes the platform paste action
- **THEN** the browser SHALL retain native text-input paste behavior at the caret or current selection
- **AND** the paste action SHALL NOT force a complete-value replacement or exit editing mode

#### Scenario: Paste does not alter non-text controls

- **WHEN** a disabled text-entry cell or a non-text-entry grid control has keyboard focus and the user invokes paste
- **THEN** this focused-cell replacement behavior SHALL NOT mutate the control

#### Scenario: Editing Return commits and retains focus

- **WHEN** a text-entry grid cell is editing and the user presses `Return`
- **THEN** the edit SHALL commit
- **AND** the cell SHALL exit editing mode while retaining focus

#### Scenario: Escape restores the edit-entry value

- **WHEN** a text-entry grid cell is editing and the user presses `Escape`
- **THEN** the cell SHALL restore the value present when editing began
- **AND** the cell SHALL exit editing mode while retaining focus

#### Scenario: Editing arrow keys remain native

- **WHEN** a text-entry grid cell is editing and the user presses an arrow key
- **THEN** the key SHALL move the text caret or selection according to native input behavior
- **AND** the grid SHALL NOT convert that keypress into cell navigation even when the caret is at a text boundary

#### Scenario: Pointer departure commits the edit

- **WHEN** the user leaves an edited text-entry cell through a pointer interaction elsewhere
- **THEN** the edit SHALL commit before focus moves to the new pointer target

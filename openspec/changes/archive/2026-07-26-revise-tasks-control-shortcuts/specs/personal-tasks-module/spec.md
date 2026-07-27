## ADDED Requirements

### Requirement: Revised Control task-command layout
BathOS Tasks SHALL expose the revised Control-based task-command layout, SHALL remove the displaced task-command assignments, and SHALL preserve platform-standard Undo and Redo behavior.

#### Scenario: Mac task commands use the revised layout
- **WHEN** a user operates Tasks on Mac
- **THEN** Control+Q SHALL open or close the focused task
- **AND** Control+W and Control+S SHALL open the previous and next tasks
- **AND** Control+E, Control+R, Control+T, and Control+G SHALL choose Start, cycle the day horizon, clear Start, and set Start to Someday
- **AND** Control+A SHALL create a new task
- **AND** Control+D SHALL choose Deadline
- **AND** Control+F SHALL cycle Actionability
- **AND** Control+X SHALL toggle Done
- **AND** Control+C, Control+V, and Control+B SHALL edit the checklist, choose Area or Project, and edit the reminder

#### Scenario: Windows task commands use shifted Alt
- **WHEN** a user operates Tasks on Windows
- **THEN** every revised Tasks-specific command SHALL use Alt+Shift with the same letter assigned to Control on Mac
- **AND** unshifted Windows Control combinations SHALL retain their standard application meanings

#### Scenario: Undo and Redo preserve platform conventions
- **WHEN** a Mac user presses either Command+Z or Control+Z
- **THEN** Tasks SHALL invoke Undo
- **WHEN** a Mac user presses Command+Y or Command+Shift+Z
- **THEN** Tasks SHALL invoke Redo
- **WHEN** a Windows user presses Control+Z
- **THEN** Tasks SHALL invoke Undo
- **WHEN** a Windows user presses Alt+Shift+Z
- **THEN** Tasks SHALL invoke Undo
- **WHEN** a Windows user presses Control+Y or Control+Shift+Z
- **THEN** Tasks SHALL invoke Redo

#### Scenario: Displaced task-command assignments are removed
- **WHEN** a user presses a former Tasks-specific chord that is absent from the revised layout
- **THEN** Tasks SHALL NOT invoke that chord's former task action

#### Scenario: Keyboard reference matches executable behavior
- **WHEN** a user opens the Keyboard Commands dialog or reads the Tasks guide
- **THEN** the displayed Control commands SHALL match the executable platform-specific layout

#### Scenario: Alternate command notation uses slashes
- **WHEN** the Keyboard Commands dialog presents alternate Undo or Close Open Task chords
- **THEN** it separates those chords with `/` rather than the word `or`, matching the Redo row

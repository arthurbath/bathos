## ADDED Requirements

### Requirement: Global quick entry presents a compact stable editor
The macOS Tasks companion SHALL present global quick entry in a balanced panel large enough for the compact Start picker and control focus outlines, SHALL show native progress until web content is ready, and SHALL not flash intermediate web states.

#### Scenario: Open global quick entry
- **WHEN** the global quick-entry shortcut is invoked while the panel is closed
- **THEN** a compact centered panel appears immediately with a centered spinner and replaces it once with the ready editor without clipping internal focus outlines

#### Scenario: Open the Start picker
- **WHEN** the user opens the compact Start picker inside quick entry
- **THEN** the picker fits within the panel's balanced content padding without forcing the panel to grow or clipping the picker

### Requirement: Global quick entry commits explicitly and cancels cleanly
The macOS Tasks companion SHALL treat Save, Return, and Command+Return as positive quick-entry submission and SHALL treat Escape, panel dismissal, or a second global-shortcut invocation as cancellation.

#### Scenario: Save quick entry
- **WHEN** the user activates Save or a supported submit key with a valid Summary
- **THEN** Tasks commits the task, reports committed completion to the native shell, and closes the panel

#### Scenario: Toggle quick entry closed
- **WHEN** the global quick-entry shortcut is invoked while its panel is already open
- **THEN** Tasks cancels the draft, discards or recoverably deletes any task created for that draft, and closes the panel

#### Scenario: Cancel quick entry
- **WHEN** the user presses Escape or dismisses the quick-entry panel without submitting
- **THEN** Tasks performs the same draft cancellation before closing and does not retain a committed task

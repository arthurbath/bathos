## MODIFIED Requirements

### Requirement: Native macOS Task Navigation Commands
The Mac companion SHALL own desktop view shortcuts before WebKit or macOS can reserve them.

#### Scenario: Switch views with Command and a number
- **WHEN** the Tasks window is active and the user presses Command+1, Command+2, Command+3, Command+4, Command+5, or Command+6
- **THEN** the app routes the existing web view to Today, Upcoming, Anytime, Someday, Done, or Settings respectively without opening a second window

#### Scenario: Open Settings with the conventional macOS shortcut
- **WHEN** the Tasks app is active and the user presses Command+,
- **THEN** the app routes the existing web view to Settings without opening a second window

#### Scenario: Retain web Control shortcuts
- **WHEN** the user presses an existing Control-based Tasks shortcut not owned by a native menu command
- **THEN** the key event remains available to the web module and retains its documented Tasks behavior

## ADDED Requirements

### Requirement: Dependable web view-navigation commands
The system SHALL provide Control+1 through Control+6 as the documented web commands for the six primary Tasks views on Mac and Windows, while compatible Mac browsers MAY continue to accept Command+1 through Command+6 as aliases.

#### Scenario: Navigate with Control-number on Mac web surfaces
- **WHEN** the user presses Control+1, Control+2, Control+3, Control+4, Control+5, or Control+6 on a Mac browser or installed web app
- **THEN** Tasks navigates to Today, Upcoming, Anytime, Someday, Done, or Config respectively
- **AND** suppresses the matching page-level action

#### Scenario: Navigate with Control-number on Windows web surfaces
- **WHEN** the user presses Control+1, Control+2, Control+3, Control+4, Control+5, or Control+6 on Windows
- **THEN** Tasks navigates to Today, Upcoming, Anytime, Someday, Done, or Config respectively
- **AND** suppresses the matching page-level action

#### Scenario: Preserve a delivered Command-number alias
- **WHEN** a Mac browser delivers Command+1 through Command+6 to the mounted Tasks route
- **THEN** Tasks navigates to the corresponding primary view and suppresses the matching page-level action

#### Scenario: Describe the reliable web shortcut
- **WHEN** the user opens Keyboard Commands in the web application or an installed PWA
- **THEN** View Navigation shows Control+1 through Control+6 for both Mac and Windows
- **AND** does not advertise Command-number as a dependable web command

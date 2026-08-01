## MODIFIED Requirements

### Requirement: Configurable macOS Task List Widget
The Mac companion SHALL provide one configurable large WidgetKit surface for Today, Upcoming, Anytime, and Someday using the shared Apple-platform Tasks widget behavior.

#### Scenario: Configure the Mac widget
- **WHEN** the user edits the Mac widget
- **THEN** the choices are Today, Upcoming, Anytime, and Someday, with Done omitted

#### Scenario: Render a populated list
- **WHEN** a valid owner-scoped projection exists for the configured list
- **THEN** the widget shows the canonical list identity and up to the first ten tasks in authoritative order using the same presentation policy as the iOS large widget

#### Scenario: Complete a task
- **WHEN** the user activates an open task's completion control
- **THEN** the widget performs the existing narrow owner-scoped completion action, displays its optimistic acknowledgement, and reconciles the cached lists without opening the app

#### Scenario: Show a Primary Link
- **WHEN** a projected task has an approved Primary Link
- **THEN** its generic or protocol-specific native identity icon uses the shared native system blue link treatment

#### Scenario: Open a Primary Link
- **WHEN** the user activates the projected task's Primary Link control
- **THEN** macOS opens the normalized destination in the default browser or protocol application without opening the Tasks app

#### Scenario: Refresh independently
- **WHEN** WidgetKit requests a timeline while a valid widget credential exists
- **THEN** the extension requests a current bounded projection, atomically stores a valid result, and retains the last valid cache when refresh fails

#### Scenario: Preserve widget privacy
- **WHEN** the Mac widget renders owner task content
- **THEN** task summaries participate in system privacy treatment and the cache excludes notes, checklist text, authentication material, and raw errors

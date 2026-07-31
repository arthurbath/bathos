## ADDED Requirements

### Requirement: Configurable Global macOS Quick Entry
The macOS companion SHALL let the user record one global keyboard shortcut and SHALL use it to present the authoritative Tasks new-task editor from any active macOS application.

#### Scenario: Configure the shortcut
- **WHEN** Tasks runs in the native macOS companion and the user activates the Global Quick Entry shortcut recorder in Settings
- **THEN** the next supported modified keystroke becomes the persisted shortcut, replaces any prior registration, and is displayed using macOS shortcut notation

#### Scenario: Withhold the setting outside native macOS
- **WHEN** Tasks runs in an ordinary browser, a PWA, or the iOS companion
- **THEN** the Global Quick Entry Settings card is absent

#### Scenario: Invoke the shortcut globally
- **WHEN** the configured shortcut is pressed while any macOS application is active
- **THEN** Tasks presents a compact centered overlay above the current Space without first requiring the main Tasks window to be active

#### Scenario: Reuse the authoritative task form
- **WHEN** the quick-entry overlay opens
- **THEN** it hosts the same Summary, Notes, Primary Link, checklist, Start, Deadline, Area, Actionability, reminder, picker, and Control-command behavior as the web new-task workflow

#### Scenario: Submit quick entry
- **WHEN** the user commits a nonempty quick-entry draft
- **THEN** Tasks creates exactly one task through the ordinary authenticated task repository, closes the overlay, and refreshes the main Tasks surface and native widgets

#### Scenario: Cancel quick entry
- **WHEN** the user cancels the overlay or dismisses an empty draft
- **THEN** the overlay closes without creating or changing a task

#### Scenario: Preserve shortcut safety
- **WHEN** a shortcut is unsupported, reserved, incomplete, or cannot be registered
- **THEN** Tasks keeps the prior working registration, explains the failure without exposing raw native diagnostics, and logs bounded diagnostic detail

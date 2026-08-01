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
- **THEN** it opens at a stable content size sufficient to display the form and hosts the same Summary, Notes, Primary Link, checklist, Start, Deadline, Area, Actionability, reminder, picker, and Control-command behavior as the web new-task workflow

#### Scenario: Preserve overlay geometry during native hosting
- **WHEN** AppKit installs or reuses the SwiftUI-hosted WebKit surface
- **THEN** the quick-entry panel retains its declared content size instead of collapsing to the hosted view's initial intrinsic size

#### Scenario: Present only the quick-entry editor
- **WHEN** the global quick-entry overlay displays a new-task draft
- **THEN** Tasks shows the shared metadata editor without the list summary row, completion control, ellipsis menu, or blue open-task background

#### Scenario: Keep temporal pickers inside the overlay
- **WHEN** the user opens Start or Deadline from global quick entry
- **THEN** Tasks centers the authoritative picker in the overlay viewport, preserves its keyboard navigation and focus handoff, and does not clip it against the editor field position

#### Scenario: Edit content that exceeds the overlay
- **WHEN** Notes or checklist content becomes taller than the quick-entry overlay
- **THEN** the editor remains vertically scrollable and the user can create and edit checklist items through the same controls as the ordinary new-task form

#### Scenario: Submit quick entry
- **WHEN** the user commits a nonempty quick-entry draft
- **THEN** Tasks creates exactly one task through the ordinary authenticated task repository, closes the overlay, and refreshes the main Tasks surface and native widgets

#### Scenario: Cancel quick entry
- **WHEN** the user cancels the overlay or dismisses an empty draft
- **THEN** the overlay closes without creating or changing a task

#### Scenario: Preserve shortcut safety
- **WHEN** a shortcut is unsupported, reserved, incomplete, or cannot be registered
- **THEN** Tasks keeps the prior working registration, explains the failure without exposing raw native diagnostics, and logs bounded diagnostic detail

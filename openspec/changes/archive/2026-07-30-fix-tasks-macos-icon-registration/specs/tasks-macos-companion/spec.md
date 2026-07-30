## ADDED Requirements

### Requirement: Canonical macOS Tasks Icon
The macOS companion SHALL present the canonical Tasks artwork as a full-bleed native app icon wherever macOS displays the application or its WidgetKit provider.

#### Scenario: Apply the macOS icon mask
- **WHEN** macOS renders the Tasks app icon in Finder, the Dock, Spotlight, an application menu, or Notification Center's widget selector
- **THEN** the black artwork fills the system-provided squircle and the system mask clips its outer rectangular corners without showing an inset source rectangle

#### Scenario: Preserve canonical artwork
- **WHEN** the Mac icon is built
- **THEN** it uses the existing Tasks PWA artwork as its visual authority and preserves the white SquareCheckBig concept on the dark Tasks background

#### Scenario: Preserve the iOS icon
- **WHEN** the Mac-specific icon implementation changes
- **THEN** the iOS companion continues using its existing correctly rendered app icon

### Requirement: Singular macOS Tasks Widget Registration
The installed Mac companion SHALL expose one current `Tasks` WidgetKit provider and SHALL NOT leave a separate superseded `BathOS Tasks` provider registered.

#### Scenario: Discover Tasks widgets
- **WHEN** Notification Center enumerates widgets from `/Applications/Tasks.app`
- **THEN** it presents the unified `Tasks` provider with the native Mac and paired iPhone choices under that identity

#### Scenario: Remove a stale superseded registration
- **WHEN** no `BathOS Tasks.app` bundle remains installed but LaunchServices or WidgetKit still advertises that prior name
- **THEN** the bounded installation cleanup removes the stale registration, re-registers the verified current Tasks bundle, and preserves Tasks user and widget data

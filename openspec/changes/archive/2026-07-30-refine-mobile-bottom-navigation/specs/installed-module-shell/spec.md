## MODIFIED Requirements

### Requirement: Installed module navigation uses the shared floating mobile presentation
Installed BathOS modules SHALL retain their module-local mobile destinations inside the shared floating-pill bottom navigation, including safe-area spacing and overflow access, while the platform top navigation remains absent.

#### Scenario: Use an installed module on a rounded mobile viewport
- **WHEN** a module runs in native or standalone installed mode on a mobile viewport
- **THEN** its local navigation floats above the bottom safe area inside the shared rounded outer pill without touching the viewport edges

#### Scenario: Use an installed module on a touch device
- **WHEN** a module runs as a native app or standalone PWA on a touch-capable device
- **THEN** the floating navigation retains the complete home-indicator safe-area inset plus a small fixed clearance so it sits several pixels above the indicator without overlap

#### Scenario: Reach an installed list scroll boundary
- **WHEN** a user scrolls an installed touch-device list to its maximum depth or interacts with the viewport's elastic boundary
- **THEN** the floating navigation remains pinned to the same viewport coordinate without shifting upward or becoming part of the scrollable content

#### Scenario: Present related floating list actions
- **WHEN** an installed touch-device list presents an action above the mobile navigation
- **THEN** the action is positioned from the same bottom-navigation anchor and retains the same visual gap from the navigation as it has in ordinary mobile web

#### Scenario: Use the same module in an ordinary browser
- **WHEN** a module runs in a normal browser tab rather than native or standalone installed mode
- **THEN** the floating navigation retains its established additional bottom margin

#### Scenario: Hide desktop installed-app top chrome completely
- **WHEN** a module runs in an installed desktop PWA where no top safe-area inset is needed
- **THEN** BathOS renders no hidden-header spacer, border, shadow, outline, or one-pixel top seam

#### Scenario: Open an overflow destination
- **WHEN** a module has more direct destinations than the floating navigation presents
- **THEN** the shared overflow control remains keyboard- and touch-accessible from its nested pill

## MODIFIED Requirements

### Requirement: Installed module navigation uses the shared floating mobile presentation
Installed BathOS modules SHALL retain their module-local mobile destinations inside the shared fixed floating-pill bottom navigation, including host-appropriate safe-area spacing, stable lower-scroll-boundary placement, and overflow access, while the platform top navigation remains absent.

#### Scenario: Use a native module on a rounded mobile viewport
- **WHEN** a module runs in a declared native host on a mobile viewport
- **THEN** its local navigation uses the host's existing safe-area containment and floats only a few pixels above the home-indicator boundary

#### Scenario: Use a standalone PWA on a rounded mobile viewport
- **WHEN** a module runs as a standalone PWA on a touch-capable mobile viewport
- **THEN** its local navigation clears the CSS bottom safe area and adds only the same small visual gap used by the native presentation

#### Scenario: Keep ordinary mobile web placement
- **WHEN** a module runs in an ordinary mobile browser tab
- **THEN** its local navigation retains the larger browser-context margin above the bottom safe area

#### Scenario: Keep installed navigation stationary
- **WHEN** a native or standalone touch user scrolls to the end of module content
- **THEN** the navigation does not move vertically with lower-boundary overscroll

#### Scenario: Open an overflow destination
- **WHEN** a module has more direct destinations than the floating navigation presents
- **THEN** the shared overflow control remains keyboard- and touch-accessible from its nested pill

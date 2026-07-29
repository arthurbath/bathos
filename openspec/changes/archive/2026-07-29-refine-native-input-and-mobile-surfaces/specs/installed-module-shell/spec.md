## ADDED Requirements

### Requirement: Installed module navigation uses the shared floating mobile presentation
Installed BathOS modules SHALL retain their module-local mobile destinations inside the shared floating-pill bottom navigation, including safe-area spacing and overflow access, while the platform top navigation remains absent.

#### Scenario: Use an installed module on a rounded mobile viewport
- **WHEN** a module runs in native or standalone installed mode on a mobile viewport
- **THEN** its local navigation floats above the bottom safe area inside the shared rounded outer pill without touching the viewport edges

#### Scenario: Open an overflow destination
- **WHEN** a module has more direct destinations than the floating navigation presents
- **THEN** the shared overflow control remains keyboard- and touch-accessible from its nested pill

## ADDED Requirements

### Requirement: Apple Companion Widget Parity
The iOS and macOS Tasks companions SHALL compile the same large-widget renderer, configuration intent, bounded snapshot model, completion action, Primary Link action, iconography, and presentation limits except where an operating system does not support a family or control.

#### Scenario: Change shared large-widget behavior
- **WHEN** the shared large-widget rendering or interaction contract changes
- **THEN** both the iOS and macOS widget targets consume that change from shared source unless a documented platform capability requires a conditional branch

#### Scenario: Preserve iOS-only widget families
- **WHEN** the iOS widget target builds
- **THEN** it retains the existing large Home Screen and rectangular Lock Screen families while the macOS target exposes only the large family

#### Scenario: Preserve iOS-only system controls
- **WHEN** the macOS widget target builds
- **THEN** it excludes the iOS Control Center implementation without removing or changing that control from the iOS target

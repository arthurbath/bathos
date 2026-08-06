## ADDED Requirements

### Requirement: iOS widget accepts server-triggered refresh opportunities
The iOS Tasks widget extension SHALL require iOS 26 or later, register its WidgetKit push token through the narrow widget authority, and use accepted pushes to request its existing authoritative timeline. The host app MAY retain an earlier deployment target independently of the widget extension.

#### Scenario: Receive an iOS widget token
- **WHEN** WidgetKit supplies or rotates a push token and at least one Tasks widget is configured
- **THEN** the extension persists pending registration and submits it when its widget credential is available

#### Scenario: Receive an iOS widget update
- **WHEN** WidgetKit accepts a Tasks content-changed notification
- **THEN** the next timeline uses the existing bounded snapshot fetch and cache validation path

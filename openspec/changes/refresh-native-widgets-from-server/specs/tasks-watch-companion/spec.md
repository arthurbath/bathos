## ADDED Requirements

### Requirement: Watch complication accepts server-triggered refresh opportunities
The Tasks complication extension SHALL require watchOS 26 or later, register its WidgetKit push token with its installation-bound authority, and refresh the existing Today progress timeline after an accepted push. The host watch app MAY retain an earlier deployment target independently of the complication extension.

#### Scenario: Receive a watch complication update
- **WHEN** WidgetKit accepts a Tasks watch content-changed notification
- **THEN** the complication requests current owner-scoped Today progress, caches a valid response, and renders that progress through the existing provider

#### Scenario: Preserve watchOS fallback
- **WHEN** a push is delayed or suppressed
- **THEN** activation refresh and later system-budgeted timelines continue updating progress

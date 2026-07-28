## MODIFIED Requirements

### Requirement: Evidence-Gated Native Apple Expansion
The system SHALL treat native Apple surfaces as optional extensions of the shared task domain and SHALL add only a specific surface whose observed or explicitly approved workflow gap cannot be served adequately by the installed web app.

#### Scenario: Continue without an unneeded native surface
- **WHEN** the installed web app, Web Push, and Raycast adequately support an observed daily workflow
- **THEN** the system continues without creating a native implementation for that workflow

#### Scenario: Diagnose a reminder incident before adding native push
- **WHEN** a production reminder is missed, duplicated, or materially late
- **THEN** the evaluation first verifies schedule computation, permission, target registration, provider outcome, and device state, and approves a native push target only when the remaining failure is a browser delivery limitation

#### Scenario: Approve a configurable task-list widget
- **WHEN** the user explicitly identifies configurable iOS Home Screen task-list widgets as a recurring native-only need
- **THEN** the system permits the smallest native host and WidgetKit extension that display owner-scoped projections of the existing Today, Upcoming, Anytime, Someday, and Done lists

#### Scenario: House the existing task product
- **WHEN** the approved task-list widget requires a containing iOS app
- **THEN** the app houses the existing Tasks web UI and does not recreate ordinary task management as a second native product

#### Scenario: Avoid a second task product
- **WHEN** a native surface reads or mutates task data
- **THEN** it uses the authoritative task-domain contract and does not introduce an independent task database, reminder scheduler, or generic mutation API

#### Scenario: Keep later Apple surfaces evidence-gated
- **WHEN** a later control, App Intent, notification target, distribution path, native editor, or Apple Watch complication is proposed
- **THEN** that surface remains outside the approved widget scope until its workflow, data, privacy, refresh, and interaction contract is explicitly approved

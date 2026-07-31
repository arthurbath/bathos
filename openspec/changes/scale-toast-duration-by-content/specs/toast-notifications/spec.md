## ADDED Requirements

### Requirement: Content-Proportional Toast Duration

BathOS SHALL automatically assign shared toast notifications a display duration based on the estimated number of visible text lines at the mobile toast width. Each estimated line SHALL contribute 1,000 ms, and every toast SHALL remain visible for at least 1,000 ms.

#### Scenario: One-Line Toast

- **WHEN** a toast contains enough title or description content for one estimated line
- **THEN** BathOS displays the toast for 1,000 ms

#### Scenario: Separate Title and Description

- **WHEN** a toast contains a one-line title and a one-line description
- **THEN** BathOS estimates two visible lines and displays the toast for 2,000 ms

#### Scenario: Wrapped Content

- **WHEN** a toast title or description exceeds the shared approximate mobile line capacity
- **THEN** BathOS adds 1,000 ms for each estimated wrapped line

#### Scenario: Explicit Line Break

- **WHEN** toast content contains an explicit line break
- **THEN** BathOS counts each resulting text line separately when calculating the duration

#### Scenario: Shared Application Behavior

- **WHEN** any BathOS module creates a toast through a shared toast service
- **THEN** the shared content-proportional duration policy applies without module-specific timing configuration

### Requirement: Toast Dismissal and Interaction

BathOS SHALL preserve each shared toast renderer's existing manual dismissal and interaction behavior while applying content-proportional automatic duration.

#### Scenario: Manual Dismissal

- **WHEN** a user dismisses a visible toast before its automatic duration ends
- **THEN** BathOS closes the toast immediately

#### Scenario: Toast Interaction

- **WHEN** the active toast renderer pauses or adjusts automatic dismissal during user interaction
- **THEN** applying the calculated duration does not replace that renderer-owned behavior

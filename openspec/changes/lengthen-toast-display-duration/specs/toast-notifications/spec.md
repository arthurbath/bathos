## MODIFIED Requirements

### Requirement: Content-Proportional Toast Duration

BathOS SHALL automatically assign shared toast notifications a display duration based on the estimated number of visible text lines at the mobile toast width. Every automatically timed toast SHALL remain visible for a base duration of 2,000 ms for its first estimated line, and BathOS SHALL add 1,500 ms for every estimated line after the first.

#### Scenario: One-Line Toast

- **WHEN** a toast contains enough title or description content for one estimated line
- **THEN** BathOS displays the toast for 2,000 ms

#### Scenario: Separate Title and Description

- **WHEN** a toast contains a one-line title and a one-line description
- **THEN** BathOS estimates two visible lines and displays the toast for 3,500 ms

#### Scenario: Wrapped Content

- **WHEN** a toast title or description exceeds the shared approximate mobile line capacity
- **THEN** BathOS adds 1,500 ms for each estimated wrapped line after the first

#### Scenario: Explicit Line Break

- **WHEN** toast content contains an explicit line break
- **THEN** BathOS counts each resulting text line separately when calculating the duration

#### Scenario: Shared Application Behavior

- **WHEN** any BathOS module creates a toast through a shared toast service
- **THEN** the shared content-proportional duration policy applies without module-specific timing configuration

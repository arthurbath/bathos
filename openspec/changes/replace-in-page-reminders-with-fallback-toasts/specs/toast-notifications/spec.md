## MODIFIED Requirements

### Requirement: Content-Proportional Toast Duration

BathOS SHALL automatically assign shared toast notifications a display duration based on the estimated number of visible text lines at the mobile toast width unless the caller explicitly supplies a duration. Each estimated line SHALL contribute 1,000 ms, and every automatically timed toast SHALL remain visible for at least 1,000 ms.

#### Scenario: Preserve an explicit duration
- **WHEN** a toast caller supplies an explicit finite or persistent duration
- **THEN** the shared renderer uses that duration instead of replacing it with the content-proportional default

### Requirement: Toast Dismissal and Interaction

BathOS SHALL preserve each shared toast renderer's manual dismissal and interaction behavior, SHALL notify the caller when its toast closes, and SHALL allow simultaneous toasts to remain independently visible.

#### Scenario: Stack simultaneous toasts
- **WHEN** multiple toasts are created before earlier toasts close
- **THEN** the shared toast state retains every active toast rather than evicting an earlier toast

#### Scenario: Notify a caller of dismissal
- **WHEN** a toast caller provides an open-state callback and the user dismisses that toast
- **THEN** the shared toast service invokes the caller callback and performs its ordinary internal dismissal

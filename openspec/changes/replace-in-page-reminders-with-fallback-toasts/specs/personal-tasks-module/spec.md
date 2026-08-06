## MODIFIED Requirements

### Requirement: Layered Reminder Delivery
The system SHALL keep the server authoritative for reminder scheduling and logical delivery identity while supporting browser notifications, Tasks-scoped in-app fallback toasts, and later native delivery targets through one idempotent contract.

#### Scenario: Present an in-app fallback reminder
- **WHEN** a due reminder is claimed while the user is viewing Tasks and the current surface does not have browser or native notifications enabled
- **THEN** Tasks shows one info-blue toast titled Reminder with a Bell icon and the to-do summary as its body
- **AND** the toast remains visible until the user manually dismisses it

#### Scenario: Stack simultaneous fallback reminders
- **WHEN** two or more reminders become due before the user dismisses an earlier reminder toast
- **THEN** Tasks keeps every reminder visible as an independently dismissible toast in the shared toast stack

#### Scenario: Acknowledge a fallback reminder
- **WHEN** the user manually dismisses a reminder toast
- **THEN** Tasks acknowledges that logical delivery and removes only that reminder toast

#### Scenario: Retry a failed reminder acknowledgement
- **WHEN** acknowledgement fails after the user dismisses a reminder toast
- **THEN** Tasks reports fixed content-free failure copy and re-presents the reminder for another manual dismissal attempt

#### Scenario: Defer to browser notifications
- **WHEN** the current browser has an active Tasks notification subscription
- **THEN** Tasks does not show an in-app reminder toast for that delivery
- **AND** notification enablement alone does not acknowledge the reminder occurrence

#### Scenario: Fall back on a blocked surface after another browser accepts Web Push
- **GIVEN** a registered Web Push target has accepted a due reminder
- **AND** the currently open Tasks surface has notifications denied, unsupported, unconfigured, revoked, or unavailable
- **WHEN** that open surface claims the due reminder for in-app presentation
- **THEN** Tasks shows the persistent in-app reminder toast on that surface
- **AND** the earlier provider acceptance does not count as manual acknowledgement

#### Scenario: Defer to native notifications
- **WHEN** the current native Tasks surface reports that operating-system notification delivery is enabled
- **THEN** Tasks does not show an in-app reminder toast for that delivery
- **AND** notification enablement alone does not acknowledge the reminder occurrence

#### Scenario: Wait for notification capability inspection
- **WHEN** the current surface is still determining whether browser or native notification delivery is enabled
- **THEN** Tasks does not prematurely show or acknowledge the fallback reminder until the capability decision settles

#### Scenario: Keep reminders inside Tasks
- **WHEN** a reminder becomes due while the user is viewing another BathOS module, or the user leaves Tasks while fallback reminder toasts are visible
- **THEN** Tasks does not create reminder toasts outside the Tasks module and removes its visible reminder toasts when the Tasks surface unmounts

#### Scenario: Omit the in-page reminder surface
- **WHEN** one or more due reminders are claimed
- **THEN** Tasks does not insert a Due Reminders panel or other reminder content into the task-list page flow

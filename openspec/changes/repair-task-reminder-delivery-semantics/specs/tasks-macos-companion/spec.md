## ADDED Requirements

### Requirement: Reliable macOS Native Reminder Notifications
The macOS companion SHALL register for APNs after operating-system notification authorization is enabled, SHALL retain bounded local scheduling as a fallback, and SHALL receive server-driven native reminders without requiring the app to remain open.

#### Scenario: Register macOS remote notifications
- **WHEN** macOS notification authorization is enabled and the app receives an application device token
- **THEN** the trusted Tasks bridge registers that token for the authenticated owner and current installation

#### Scenario: Receive while suspended
- **WHEN** the server delivers a valid owner-scoped reminder while the app is suspended
- **THEN** macOS presents the Reminder alert and sound with the task Summary

#### Scenario: Avoid an in-app duplicate
- **WHEN** macOS notification authorization is enabled
- **THEN** the embedded Tasks surface does not claim the in-app toast fallback for that surface

#### Scenario: Keep local projection as fallback
- **WHEN** the embedded Tasks surface has a future canonical reminder projection
- **THEN** the companion may reconcile local requests using the same app-owned identity without independently computing task dates or recurrence

#### Scenario: Edit enabled notification permission
- **WHEN** native notifications are already enabled and the user activates `Edit` from `Notifications & Badges`
- **THEN** the companion opens the operating system notification settings for Tasks

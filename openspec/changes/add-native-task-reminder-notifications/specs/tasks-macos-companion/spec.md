## ADDED Requirements

### Requirement: macOS Native Reminder Notifications
The macOS companion SHALL use UserNotifications to report authorization, request permission only after explicit user action, reconcile a bounded owner-scoped set of future reminder requests, and present a native Reminder notification whose body is the task Summary.

#### Scenario: Inspect macOS notification authorization
- **WHEN** the native bridge becomes available or the app returns to the foreground
- **THEN** the companion reads current authorization and reports Enabled, Not Enabled, or Blocked in Settings to the web Settings surface

#### Scenario: Enable macOS notifications
- **WHEN** authorization is not determined and the user activates Enable
- **THEN** macOS presents its notification permission workflow and Tasks refreshes the reported status after the workflow completes

#### Scenario: Route denied authorization to Settings
- **WHEN** macOS authorization is denied and the user activates Enable
- **THEN** the companion opens macOS Notification settings when the operating system exposes that destination

#### Scenario: Schedule an authoritative reminder
- **WHEN** an open present task has a future active reminder whose local date matches the task Start date synchronized to the companion and notification authorization is enabled
- **THEN** the companion schedules one app-owned local notification titled Reminder with the task Summary as its body at that exact instant

#### Scenario: Reconcile changed reminders
- **WHEN** the synchronized reminder projection changes
- **THEN** the companion removes obsolete app-owned pending requests and schedules the earliest bounded future requests without changing unrelated notifications

#### Scenario: Present while foregrounded
- **WHEN** an app-owned reminder fires while Tasks is in the foreground
- **THEN** macOS still presents its native banner and sound and the web app does not present a duplicate in-app toast

#### Scenario: Open the reminded task
- **WHEN** the user activates an app-owned reminder notification
- **THEN** the companion opens the referenced task through the existing native task route

#### Scenario: Fall back when native notifications are unavailable
- **WHEN** macOS authorization is not enabled
- **THEN** the companion reports native notifications as disabled and an open Tasks web surface remains eligible to show the persistent in-app reminder toast

## Why

The Tasks list currently reserves page space for a due-reminders panel even though reminders are transient notifications. That panel competes with the task content, cannot represent simultaneous reminders as independent acknowledgements, and duplicates browser or future native notification delivery when those capabilities are enabled.

## What Changes

- Remove the in-page Due Reminders panel from Tasks views.
- Present each due reminder as an info-blue, manually dismissed toast titled Reminder with a bell icon and the task summary as its body.
- Allow multiple reminder toasts to remain visible together without one reminder evicting another.
- Suppress in-app reminder presentation when the current surface has browser or native notifications enabled without falsely acknowledging an unseen notification.
- Preserve an open surface's in-app fallback opportunity when a different registered Web Push target accepts the reminder.
- Keep reminder toasts scoped to Tasks routes and dismiss them when the Tasks surface unmounts.
- Preserve content-free acknowledgement failure reporting and make a failed acknowledgement available for another manual dismissal attempt.
- Extend the native Tasks context with an explicit notification-authorization signal that currently defaults to disabled until native notification delivery is implemented.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Replace the in-page reminder surface with notification-aware fallback toasts scoped to Tasks.
- `toast-notifications`: Support persistent, independently dismissible stacked toasts while retaining the shared duration default for ordinary toasts.

## Impact

- Affects Tasks reminder presentation and acknowledgement handling.
- Affects the shared toast reducer, renderer, and semantic variants.
- Adds a forward-compatible native notification capability flag without enabling native notification delivery.
- Does not change reminder scheduling, Web Push registration, or native notification authorization.

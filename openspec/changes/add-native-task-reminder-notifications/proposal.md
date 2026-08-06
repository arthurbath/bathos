## Why

The iOS and macOS Tasks companions currently suppress in-app reminder toasts based on a hard-coded native capability flag but cannot request notification permission or deliver reminders through the operating system. Users need reminder delivery to continue when a native app is not foregrounded, with the current surface's Settings view accurately explaining and enabling that capability.

## What Changes

- Add owner-scoped local notification scheduling to the iOS and macOS companions from the authoritative synchronized reminder projection.
- Add native notification permission inspection, an explicit Enable workflow, foreground banner presentation, obsolete-request reconciliation, and task routing when a notification is opened.
- Request badge permission with notifications and keep the native app icon badge synchronized to the full Today-list task count across every horizon.
- Replace application-level notification toggles with capability status and, where possible, an Enable action that delegates control to browser or operating-system settings.
- Keep non-expiring in-app reminder toasts as the automatic fallback whenever the current surface lacks enabled native or browser notifications.
- Add a bounded, versioned web-to-native reminder bridge without adding a second task database, server scheduler, Supabase object, or secret.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Clarify layered delivery and surface-owned notification Settings behavior.
- `tasks-ios-companion`: Add iOS notification authorization and local reminder scheduling to the thin companion.
- `tasks-macos-companion`: Add macOS notification authorization and local reminder scheduling to the thin companion.

## Impact

The change affects the Tasks reminder hook, native bridge, Settings presentation, iOS/macOS WebKit hosts, shared native browser model, native widget snapshot cache and read RPC, native tests, React tests, and the companion documentation. It uses Apple's UserNotifications framework already supplied by the operating systems. One additive function migration publishes an unfiltered Today count without changing tables, secrets, PowerSync schema, or production data.

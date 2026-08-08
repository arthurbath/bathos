## Why

Task reminders currently depend on an open embedded web view projecting future reminders into local notification schedules, so authorized iOS and macOS apps can miss reminders while suspended or after stale synchronization. In-app fallback claims can also surface reminders that became due before the current viewing session, which contradicts the intended live-session-only toast behavior.

## What Changes

- Add server-driven APNs reminder delivery for each authorized iOS and macOS installation, while retaining local scheduling as a best-effort fallback.
- Register, refresh, and retire app notification device tokens through an installation-bound, owner-scoped authority.
- Dispatch native reminder payloads from the authoritative reminder occurrence and delivery records without requiring an open app or web view.
- Restrict in-app reminder claims to occurrences that became due during the current visible Tasks session.
- Keep browser Web Push and per-native-installation delivery independent; suppress only the in-app fallback for a surface whose deeper notification channel is active.
- Treat notification dismissal as device-local because Apple does not provide automatic cross-device dismissal synchronization for ordinary app notifications.

## Capabilities

### New Capabilities

- `tasks-native-reminder-push`: Owner-scoped iOS and macOS APNs registration, dispatch, retirement, and deep-link delivery semantics.

### Modified Capabilities

- `personal-tasks-module`: In-app reminder fallback is limited to reminders becoming due during the current visible Tasks session.
- `tasks-ios-companion`: Authorized iOS installations receive server-driven native task reminders without requiring the app to remain open.
- `tasks-macos-companion`: Authorized macOS installations receive server-driven native task reminders without requiring the app to remain open.

## Impact

- Tasks reminder RPCs, delivery targets, and dispatcher functions in Supabase.
- iOS and macOS application entitlements, remote-notification registration, bridge state, and notification handling.
- Tasks reminder hooks and tests for session-scoped fallback behavior.
- Deployment configuration for APNs signing credentials and the reminder dispatcher schedule.

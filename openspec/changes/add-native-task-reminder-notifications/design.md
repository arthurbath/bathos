## Context

Tasks already computes reminder instants authoritatively in PostgreSQL and synchronizes each active reminder's `resolved_at` timestamp through PowerSync. Browser delivery uses Web Push when explicitly enabled and otherwise claims due occurrences for persistent in-app toasts. The native iOS and macOS hosts already expose a narrow versioned WebKit bridge, but both inject `notificationsEnabled: false` and implement no UserNotifications behavior.

The native apps must deliver reminders while suspended without creating a second recurrence or date-calculation implementation. Notification authorization is controlled by Apple system settings, and iOS limits the number of pending local notifications, so native scheduling must be a bounded projection that can be reconciled whenever synchronized data changes or the app becomes active.

## Goals / Non-Goals

**Goals:**

- Inspect and request native notification authorization on iOS and macOS.
- Show the current surface's status in Tasks Settings without adding an application-level on/off preference.
- Reconcile a bounded set of future local notification requests from authoritative synchronized reminder instants.
- Present the native banner while the companion is foregrounded and open the relevant task when the user activates a notification.
- Keep the iOS Home Screen and macOS Dock badges synchronized to the full Today-list count while notification and badge authorization are enabled.
- Preserve the in-app toast fallback unless the current surface has enabled browser or native notifications.

**Non-Goals:**

- Add remote APNs reminder delivery, device-token registration, or a new Supabase delivery target.
- Recompute reminder dates or recurrence rules in Swift.
- Guarantee delivery for reminders created or changed after a native app's last successful synchronization.
- Add an in-app preference that overrides browser or operating-system notification settings.

## Decisions

### Use reconciled local notifications from `resolved_at`

The web module will publish active, open-task reminders with task identity, Summary, and canonical `resolved_at` through the existing authenticated native bridge. Swift will schedule the earliest future requests through `UNUserNotificationCenter`, removing obsolete app-owned pending and delivered requests during reconciliation. This preserves one reminder-time authority and supports offline firing after the app is suspended.

The alternative was a new APNs provider pipeline. That would require device tokens, server credentials, production dispatch changes, and provider-result handling. It is unnecessary for reminders already known to the synchronized native app and would expand the security and deployment surface.

### Bound the projection and reserve Apple notification capacity

The bridge will publish at most 256 future reminders. Each native host will schedule the earliest 60, leaving capacity below iOS's pending-request ceiling for system or future Tasks uses. Every data refresh replaces only identifiers in the Tasks reminder namespace.

### Treat system authorization as the sole preference

The Settings card will report Checking, Enabled, Not Enabled, Blocked in Settings, or Unavailable. Not-determined authorization offers Enable and requests permission. A denied native status offers Enable as a route to the operating system's notification settings when the platform exposes that route. Active browser notifications report Enabled instead of rendering a second toggle.

### Keep fallback choice reactive

The native host sends an initial authorization event after the WebKit bridge binds and refreshes it when the application becomes active. React listens to that event rather than relying on a frozen launch-time boolean. Only an enabled native authorization status suppresses browser or in-app reminder presentation.

### Present foreground notifications natively

The shared notification coordinator is the `UNUserNotificationCenterDelegate` and opts into banner and sound presentation while Tasks is foregrounded. Activating a notification routes the existing WebKit host to the referenced task through the established native task route.

### Derive badges from the authoritative Today snapshot

The native hosts will request badge authorization alongside alert and sound authorization. Whenever the foreground web bridge or the credential-backed background refresh accepts a widget snapshot, the shared notification coordinator will set the application badge to the snapshot's dedicated unfiltered Today count. The badge deliberately ignores Today horizon, active quick filters, and the snapshot's bounded visible task rows. Older cached schema-version-2 snapshots remain readable and temporarily fall back to the Today list's existing `totalCount` until the next refresh. If notification authorization or badge presentation is disabled, the owner signs out, or the Today count reaches zero, the coordinator clears the badge.

## Risks / Trade-offs

- [A native app has not synchronized recently] -> The app schedules all bounded future authoritative reminders whenever synchronized data is available and refreshes on each foreground activation; documentation states that current data must have reached the app.
- [More than 60 future reminders exist] -> Schedule the earliest 60 and republish on subsequent data changes or foreground refreshes.
- [Authorization changes in system settings while Tasks is open] -> Refresh authorization on app activation and on every explicit status request.
- [The operating system separately disables app-icon badges] -> Respect the operating-system badge setting and clear the application badge while it is disabled.
- [The widget snapshot contains fewer rows than the Today list] -> Use `totalCount`, never `tasks.count`, so truncation does not undercount the badge.
- [A quick filter hides Today tasks in widget presentation] -> Carry a separate unfiltered Today count so presentation filters do not reduce the badge.
- [A removed task leaves a local notification] -> Reconciliation removes every app-owned pending identifier absent from the latest owner projection.
- [Local delivery is not a server delivery receipt] -> Preserve server reminder identity and do not claim provider acknowledgement from local scheduling.
- [Legacy native builds do not understand the message] -> The web bridge remains version 2 and unsupported message types are ignored by older native hosts; the web surface continues using in-app fallback because those hosts never report enabled authorization.

## Migration Plan

1. Publish the web/native bridge and Settings behavior with regression tests.
2. Build and verify iOS and macOS companions containing the shared notification coordinator.
3. Install the signed companions. On first Enable, each OS requests authorization and the next reminder projection schedules local requests.
4. Rollback is code-only: older companions ignore the new message and the web app falls back to in-app toasts because native capability remains disabled.

One additive database-function migration publishes the unfiltered Today count through the existing credential-backed snapshot RPC. It does not rewrite production data or change authorization.

## Open Questions

None.

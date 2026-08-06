## 1. Web Contract and Settings

- [x] 1.1 Add a reactive native notification authorization bridge and capability model.
- [x] 1.2 Publish a bounded owner-scoped future reminder projection to native companions.
- [x] 1.3 Replace browser/native Settings toggles and placeholder copy with status and Enable behavior.
- [x] 1.4 Keep in-app reminder toasts enabled unless browser or native notification authorization is active.
- [x] 1.5 Rename the Settings feature to Notifications & Badges while preserving operating-system authority.

## 2. Apple Companion Implementation

- [x] 2.1 Add shared UserNotifications authorization, status reporting, and settings routing for iOS and macOS.
- [x] 2.2 Reconcile app-owned pending local notifications from canonical reminder instants.
- [x] 2.3 Present native reminders in the foreground and route notification activation to the referenced task.
- [x] 2.4 Refresh authorization and schedules when each companion becomes active.
- [x] 2.5 Request badge authorization and synchronize the iOS and macOS badges from the full Today-list count.

## 3. Verification and Documentation

- [x] 3.1 Add TypeScript coverage for bridge messages, reactive authorization, projection filtering, Settings, and fallback selection.
- [x] 3.2 Add iOS and macOS native coverage for status mapping, bounded schedules, content, and bridge validation.
- [x] 3.3 Update companion and Tasks documentation for native reminder behavior and operating-system authority.
- [x] 3.4 Run targeted tests, full Vitest, lint, production build, OpenSpec validation, and iOS/macOS builds.
- [x] 3.5 Add badge-count regression coverage and document native badge behavior.
- [x] 3.6 Keep badge totals independent of widget quick filters across foreground and background snapshots.

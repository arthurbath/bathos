# Tasks iOS Companion

This Xcode project contains the thin native BathOS Tasks companion, its configurable Home Screen and Lock Screen widgets, and its New Task system control.

## Targets

- `TasksCompanion`: SwiftUI application containing the production Tasks web application in `WKWebView`
- `TasksWidgets`: configurable WidgetKit extension for Today, Upcoming, Anytime, and Someday, plus the New Task system control on iOS 18 and later
- `TasksCompanionTests`: dependency-free tests for cache validation and deep-link routing

## Identifiers

- App: `garden.bath.tasks`
- Widget extension: `garden.bath.tasks.widgets`
- Shared App Group: `group.garden.bath.tasks`
- URL scheme: `bathostasks`

## Apple Team Setup

1. Select an eligible Apple Developer team for the app and widget targets.
2. Register both bundle identifiers.
3. Enable the App Groups capability for both identifiers.
4. Add `group.garden.bath.tasks` to both targets.
5. Let Xcode create or download the corresponding development provisioning profiles.
6. Build and install the `TasksCompanion` scheme on the intended iPhone.

Do not replace the checked-in App Group identifier or create a second shared container for local development. App and widget must use the same entitlement.

## Local Validation

With a Simulator runtime matching the installed Xcode SDK:

```sh
xcodebuild \
  -project ios/TasksCompanion/TasksCompanion.xcodeproj \
  -scheme TasksCompanion \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build-for-testing
```

Run the `TasksCompanion` scheme from Xcode to perform interactive sign-in and widget acceptance. A physical device and eligible Apple team are required to prove production App Group provisioning and Home Screen behavior.

The large Home Screen widget shows the configured list with interactive task completion and Primary Link actions. The rectangular Lock Screen widget shows up to three leading task summaries from the configured list. Tapping the Lock Screen widget opens that list in the native companion.

## Control Center

On iOS 18 or later, open Control Center editing, choose **Add a Control**, find **New Task** under Tasks, and place it in Control Center. The same control may appear on other system control surfaces supported by the installed iOS version.

The control uses Apple's adaptive `plus.square` symbol and opens the native companion to one new task in Today Inbox with Summary focused. It does not create task data inside the widget extension. The authoritative web editor retains autosave, offline, synchronization, undo, and close behavior. If one unsaved draft is already open, the control returns focus to that draft instead of replacing it.

The control is unavailable on iOS 17. The containing app and existing widgets remain available there.

## Privacy Boundary

The companion accepts widget snapshots only from the main frame at `https://os.bath.garden/tasks/*`. The versioned decoder enforces list, row, string, date, and enum bounds before atomically replacing the App Group cache.

The cache intentionally omits authentication material, notes, checklist text, Mail source metadata, and raw errors. It contains only the bounded list information rendered by the widget, including an optional normalized Primary Link action for approved HTTP, HTTPS, or Mail-message URLs. Signing out clears the cache and the separate completion-only native credential.

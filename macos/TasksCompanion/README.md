# Tasks for macOS

Tasks for macOS is a thin SwiftUI and `WKWebView` companion for the
authoritative Tasks web application. It adds native macOS keyboard ownership,
deep links, persistent WebKit storage, and the shared large Tasks widget without
creating a second task repository.

## Identifiers

- App: `garden.bath.tasks` on iOS and macOS
- Widget: `garden.bath.tasks.widgets` on iOS and macOS
- WidgetKit kind: `garden.bath.tasks.list-widget` on iOS and macOS
- URL scheme: `bathostasks`
- Shared App Group: `group.garden.bath.tasks`
- Apple development team: `SPJYXE7ZA3`

Both the app and widget use Apple automatic signing. Do not remove the App Group
entitlement, substitute ad-hoc signing, or install an output whose containing
app and nested widget have not both passed strict signature verification.

## Unsigned Validation

Use the same Xcode installation for the app and iOS regression builds. The
commands below use Xcode Beta explicitly because that is the current BathOS
Tasks development toolchain.

```sh
export DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer

xcodebuild \
  -project macos/TasksCompanion/TasksCompanion.xcodeproj \
  -scheme TasksMac \
  -destination 'platform=macOS' \
  -derivedDataPath /tmp/BathOSTasksMacDerivedData \
  CODE_SIGNING_ALLOWED=NO \
  test

xcodebuild \
  -project ios/TasksCompanion/TasksCompanion.xcodeproj \
  -scheme TasksCompanion \
  -configuration Debug \
  -destination 'generic/platform=iOS' \
  -derivedDataPath /tmp/BathOSTasksIOSRegressionDerivedData \
  CODE_SIGNING_ALLOWED=NO \
  build
```

## Verified Signed Installation

Xcode must be signed in to the configured Apple account, and the Apple
Developer team must be able to provision both bundle identifiers with the
shared App Group.

```sh
export DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer

xcodebuild \
  -project macos/TasksCompanion/TasksCompanion.xcodeproj \
  -scheme TasksMac \
  -configuration Release \
  -destination 'platform=macOS,arch=arm64' \
  -derivedDataPath /tmp/BathOSTasksMacSignedDerivedData \
  -allowProvisioningUpdates \
  TASKS_WIDGET_APNS_ENVIRONMENT=development \
  build

APP='/tmp/BathOSTasksMacSignedDerivedData/Build/Products/Release/Tasks.app'
WIDGET="$APP/Contents/PlugIns/TasksMacWidgets.appex"

codesign --verify --deep --strict --verbose=2 "$APP"
codesign --verify --strict --verbose=2 "$WIDGET"
codesign -dvvv -r- "$APP"
codesign -dvvv -r- "$WIDGET"
codesign -d --entitlements :- "$APP"
codesign -d --entitlements :- "$WIDGET"
```

Direct personal installations use an Apple Development provisioning profile,
so their widget registration must target the APNs sandbox. Keep the explicit
`TASKS_WIDGET_APNS_ENVIRONMENT=development` override above even though this is
an optimized Release build. A distribution/archive build must instead use the
production environment and a matching distribution profile.

Only after all checks pass, use the guarded installer. It repeats signature and
identity verification, requires Tasks to be stopped, fingerprints every active
PowerSync database, replaces only the application bundle, and proves that the
database fingerprints are unchanged before relaunching Tasks:

```sh
node scripts/install-tasks-native.mjs macos --app "$APP"
```

Do not substitute an uninstall/reinstall sequence or a direct bundle copy. The
guarded installer stages and verifies the new output, keeps the previous app
available for rollback until cache continuity passes, and moves that prior
bundle to the Trash only after success. A signing, identity, running-process,
or cache-continuity failure leaves the durable application container and the
last verified installed app intact. Do not remove the App Group container or
WebKit data when replacing or unregistering a prior build.

The default cache root is
`~/Library/Containers/garden.bath.tasks/Data/Library/WebKit/WebsiteData`. A
different test installation may pass `--installed-app` and `--container-root`.
Use `--no-launch` when post-install inspection must occur before launch.

After installing, inspect LaunchServices and WidgetKit registrations for the
exact `garden.bath.tasks` app and `garden.bath.tasks.widgets` extension. Remove
only registrations that resolve to a superseded bundle path or the old
`BathOS Tasks` display name, then explicitly register
`/Applications/Tasks.app` and its embedded widget. Do not reset the global
LaunchServices database or unregister unrelated applications.

## Native Behavior

- Tasks Settings reports macOS notification authorization under **Notifications & Badges** and offers **Enable** to request alert, sound, and badge permission or open Notification settings. macOS Settings remains the sole on/off authority.
- The app reconciles the earliest 60 active future reminder instants received from the trusted web bridge into local UserNotifications. Native reminders use the title `Reminder`, the task Summary as body, a banner and sound in the foreground, and the existing task route when activated. When authorization is not enabled, an open Tasks surface retains the in-app toast fallback.
- While notification and badge authorization are enabled, the Dock badge uses the Today list's aggregate unfiltered task count across all horizons. Foreground and credential-backed background snapshots both refresh it, quick filters and bounded widget rows do not constrain it, and sign-out, zero tasks, or disabled authorization clears it.
- The hosted Tasks web view accepts AppKit's first mouse event, so clicking or
  beginning a drag over a visible inactive Tasks window activates the window
  and delivers that same pointer sequence to the intended web interaction.
- Command+Option+R clears reload-safe WebKit response caches and reloads the
  current Tasks route from its origin. It preserves authentication, local
  storage, IndexedDB and OPFS task data, service-worker registrations, and
  widget data. A future native Windows host uses Control+Alt+R for the same
  command and preservation boundary.
- Command+1 through Command+6 route the existing web view to Today, Upcoming,
  Anytime, Someday, Done, and Settings.
- Unmodified Escape is consumed while the Tasks window is active, forwarded
  once to the web surface, and does not exit native full screen.
- The main window explicitly remains eligible for native macOS Split View and
  full-screen tiling, can resize down to a 360-point mobile-class content
  width, and reasserts that policy after scene and full-screen transitions.
- Internal Tasks, account, and authentication routes stay in the persistent web
  view. Other BathOS modules, ordinary web URLs, and approved external protocols
  open in the system's default application.
- `bathostasks://` deep links accept allowlisted list, task, and new-task routes.
- The configurable macOS widget offers Today, Upcoming, Anytime, and Someday and
  reuses the bounded iOS large-widget snapshot, completion, Primary Link, cache,
  and background-refresh behavior. The containing app retains macOS 14 support,
  while the widget extension requires macOS 26 so content-free WidgetKit pushes
  can accelerate its existing 30-minute requested timeline and cache fallback.

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

Only after all checks pass, stage and verify the app at the system application
location before replacing the current installation:

```sh
STAGED_APP='/Applications/.Tasks.installing.app'
INSTALLED_APP='/Applications/Tasks.app'

ditto "$APP" "$STAGED_APP"
codesign --verify --deep --strict --verbose=2 "$STAGED_APP"
codesign --verify --strict --verbose=2 \
  "$STAGED_APP/Contents/PlugIns/TasksMacWidgets.appex"
mv "$INSTALLED_APP" "$HOME/.Trash/Tasks.previous.app"
mv "$STAGED_APP" "$INSTALLED_APP"
open "$INSTALLED_APP"
```

When replacing an existing installation, stage and verify the new output first,
then move the former `Tasks.app` or `BathOS Tasks.app` to the Trash through a
recoverable operation before placing the verified replacement. Never overwrite
the installed bundle in place. A signing or entitlement failure must leave the
previous installed app untouched. Do not remove the App Group container or
WebKit data when replacing or unregistering a prior build.

After installing, inspect LaunchServices and WidgetKit registrations for the
exact `garden.bath.tasks` app and `garden.bath.tasks.widgets` extension. Remove
only registrations that resolve to a superseded bundle path or the old
`BathOS Tasks` display name, then explicitly register
`/Applications/Tasks.app` and its embedded widget. Do not reset the global
LaunchServices database or unregister unrelated applications.

## Native Behavior

- Command+Option+R clears reload-safe WebKit response caches and reloads the
  current Tasks route from its origin. It preserves authentication, local
  storage, IndexedDB and OPFS task data, service-worker registrations, and
  widget data. A future native Windows host uses Control+Alt+R for the same
  command and preservation boundary.
- Command+1 through Command+6 route the existing web view to Today, Upcoming,
  Anytime, Someday, Done, and Settings.
- Unmodified Escape is consumed while the Tasks window is active, forwarded
  once to the web surface, and does not exit native full screen.
- The main window remains eligible for native macOS Split View and can resize
  down to a 360-point mobile-class content width.
- Internal Tasks, account, and authentication routes stay in the persistent web
  view. Other BathOS modules, ordinary web URLs, and approved external protocols
  open in the system's default application.
- `bathostasks://` deep links accept allowlisted list, task, and new-task routes.
- The configurable macOS widget offers Today, Upcoming, Anytime, and Someday and
  reuses the bounded iOS large-widget snapshot, completion, Primary Link, cache,
  and background-refresh behavior.

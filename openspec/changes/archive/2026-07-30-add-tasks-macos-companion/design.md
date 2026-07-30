## Context

BathOS Tasks already has an iOS SwiftUI companion that hosts `https://os.bath.garden/tasks/*` in an app-bound `WKWebView`. The app and its WidgetKit extension share a validated, owner-scoped snapshot and credential through `group.garden.bath.tasks`; the widget can refresh independently, open list/task/Primary Link destinations, and complete tasks through the narrow widget action service.

The current Xcode project targets iOS only. Safari and installed web apps on macOS can reserve Command+number and Escape before the page receives them, so JavaScript cannot provide the required desktop contract. A native macOS host can own those key equivalents before WebKit or the window's full-screen behavior.

## Goals / Non-Goals

**Goals:**

- Provide a true macOS SwiftUI application with a persistent production Tasks `WKWebView`.
- Preserve the iOS companion's route, storage, authentication, offline, security, and widget snapshot boundaries.
- Make Command+1 through Command+6 deterministic native view commands.
- Consume Escape while the Tasks window is active, forward it to the web surface, and prevent it from exiting native full screen.
- Provide one configurable large macOS Tasks widget with the same list rendering and actions as the iOS large widget.
- Present the native app as `Tasks` and establish it as the macOS platform counterpart of the iOS companion.
- Build and install an Apple-signed app and widget using stable identifiers and the existing App Group.

**Non-Goals:**

- Reimplement the Tasks UI or data repository in AppKit.
- Add macOS notifications, Calendar, Reminders, menu-bar capture, global shortcuts, or AppleScript in this change.
- Add new server tables, credentials, Edge Functions, PowerSync tables, or task-domain mutations.
- Change the iOS Lock Screen widget or iOS Control Center surface.

## Decisions

### Add separate native macOS targets while sharing bounded Apple-platform code

A new `macos/TasksCompanion` Xcode project will contain a macOS app, a macOS widget extension, and focused tests. The project will reference the existing shared route, snapshot, configuration intent, and large-widget renderer source instead of copying those behaviors. Platform-only view branches will use compile-time conditions.

Alternative considered: Mac Catalyst. Rejected because a true AppKit lifecycle gives clearer ownership of menu commands, local key monitoring, window full-screen behavior, external navigation, and a native macOS WidgetKit extension.

### Keep the web app authoritative

The Mac app will use a non-ephemeral default `WKWebsiteDataStore`, inject the same bounded native context and widget installation identifier, and accept bridge messages only from the main frame on the trusted Tasks origin. Internal Tasks and required account/platform routes stay in the web view. Other BathOS modules and external protocols open through `NSWorkspace`.

Alternative considered: add a second native task repository. Rejected because it would duplicate PowerSync and offline behavior and risk divergent authority.

### Own desktop navigation through native commands

The app's command menu will define Command+1 through Command+6 for Today, Upcoming, Anytime, Someday, Done, and Settings. These commands route the existing web view directly and therefore remain reliable even when WebKit would otherwise reserve them.

An application-scoped AppKit key monitor will consume an unmodified Escape key-down while the Tasks window is key. It will dispatch one trusted-equivalent Escape event to the active web element and document inside the `WKWebView`, then return `nil` so AppKit cannot use that same key event to leave full screen. Modified Escape combinations and Escape outside the active Tasks window remain native.

Alternative considered: rely on JavaScript capture. Rejected because Safari/PWA testing proved the container can consume Escape first.

### Keep the main window eligible for native Split View

The main Tasks window explicitly retains the resizable style and full-screen-primary collection behavior. Its content minimum is 360 points wide and 420 points tall, which preserves the web module's proven mobile-width layout while allowing macOS to pair Tasks beside another eligible full-screen application.

Alternative considered: retain the original 640-point content minimum and rely on macOS to negotiate the pairing. Rejected because SwiftUI's content-minimum resizability turns that content constraint into the system window minimum, which can make a side-by-side full-screen placement unavailable when the paired application also has a substantial minimum width.

### Share the large widget implementation

The macOS widget target will compile the existing `TaskListWidget`, `TaskListSelectionIntent`, `CompleteTaskIntent`, route, snapshot, credential, background refresh, Primary Link, iconography, and presentation policy sources. macOS supports only `.systemLarge`; iOS continues to support `.systemLarge` and `.accessoryRectangular`. iOS-only Control Center sources remain excluded from the Mac target.

The Mac app uses the same `garden.bath.tasks` bundle identifier as the iOS app, and the Mac widget uses the same `garden.bath.tasks.widgets` bundle identifier and `garden.bath.tasks.list-widget` WidgetKit kind as the iOS widget. Both platforms retain `group.garden.bath.tasks` and the `bathostasks` URL scheme. This is the Apple platform-counterpart topology required for one app identity rather than two merely related products. Internal Xcode target and Swift module names remain platform-specific where needed to avoid source-level collisions.

The user-visible Mac app, product bundle, executable, and window title are `Tasks`. The widget bundle is user-visible as `Tasks Lists`, matching iOS. The old `BathOS Tasks.app` installation is removed from the active Applications directory after the verified `Tasks.app` replacement is installed so Launch Services and WidgetKit do not retain two competing Mac app identities.

### Use Apple automatic signing for the app-extension boundary

The Xcode targets will use automatic signing with the existing Apple developer team. A self-signed local identity is not an acceptable fallback because WidgetKit embedding and the App Group entitlement require compatible Apple provisioning. Stable bundle and App Group identifiers provide continuity across rebuilds.

The install flow builds into Derived Data, verifies the nested extension and containing app with `codesign --verify --strict`, inspects their designated requirements and entitlements, then replaces the installed copy in `~/Applications` only after those checks pass.

## Risks / Trade-offs

- [Widget App Group provisioning may not be available to the selected team] -> Use the same Apple team and App Group already proven by the iOS companion; fail closed rather than remove the entitlement or ad-hoc sign.
- [A macOS API difference may break shared widget source] -> Keep platform branches narrow and compile both iOS and macOS schemes after shared edits.
- [Synthetic web Escape may not perfectly reproduce every WebKit default] -> Dispatch to the active element and document, cover application-level Tasks handlers, and retain explicit visible controls for all operations.
- [Widget timelines are system-budgeted] -> Reuse the independent background refresher and last-valid-cache behavior rather than promise immediate refresh.
- [Production authentication may require interactive sign-in on first launch] -> Preserve the default WebKit store and expose the ordinary Tasks sign-in route; never embed credentials.

## Migration Plan

1. Add the macOS project, targets, shared source references, entitlements, assets, and tests.
2. Make the existing large widget renderer compile for both iOS and macOS without changing iOS behavior.
3. Build and test without signing, then build with automatic signing and provisioning updates.
4. Verify both signatures, identifiers, nested extension, App Group entitlements, and embedded extension.
5. Install the verified app in `~/Applications/Tasks.app`, remove the superseded `~/Applications/BathOS Tasks.app` from the active Applications directory, launch it, exercise navigation and full-screen Escape, and add/inspect the widget when the host exposes it.
6. Roll back by removing the installed Mac app; the web app, iOS app, server, and task data remain unchanged.

## Open Questions

None. Notification, Calendar, Reminders, global capture, and deeper system integrations remain explicit follow-up work.

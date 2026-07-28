## Why

BathOS Tasks is already the authoritative cross-platform task experience, but a saved web app cannot provide the configurable Home Screen widgets and deeper Apple-platform integration that make a task system ambient on iPhone. A deliberately thin native companion can preserve the existing web application as the sole task-editing UI while adding only the native surfaces the web platform cannot supply.

## What Changes

- Add a lightweight SwiftUI iOS companion that houses the production BathOS Tasks web application in a `WKWebView` rather than recreating task management natively.
- Add a configurable WidgetKit extension whose large Home Screen widget can display a selected BathOS task list, initially including Today, Upcoming, Anytime, Someday, and Done.
- Add an explicit, bounded web-to-native task-projection bridge so authenticated Tasks data can be cached in the app-group container for widgets without exposing secrets or duplicating the task domain.
- Deep-link widget taps and native app links to the corresponding BathOS Tasks route.
- Refresh widget timelines when the web projection changes and use conservative timeline refreshes for predictable staleness boundaries.
- Keep a future Apple Watch count complication and additional native niceties structurally possible, but outside the mandatory first delivery.
- Document the Apple Developer account, App Group, signing, provisioning, and physical-device steps that cannot be completed from an unsigned local environment.

## Capabilities

### New Capabilities

- `tasks-ios-companion`: Defines the web-container app, task projection bridge, configurable Home Screen widget, shared-container privacy boundary, refresh behavior, and deep-link contract.

### Modified Capabilities

- `personal-tasks-module`: Defines the authenticated, owner-scoped task-list projection that the existing web module supplies to its native companion.

## Impact

- **Tasks module:** A narrow native bridge and owner-scoped widget projection derived from the existing task repository.
- **Native client:** A new isolated iOS app and WidgetKit extension under `ios/TasksCompanion/`, with `garden.bath.tasks` namespace identifiers and an App Group shared container.
- **Platform:** Production route handling for native deep links and ordinary BathOS authentication inside `WKWebView`.
- **Supabase:** No schema, RLS, publication, role, or secret changes are required for the initial bridge-backed widget architecture.
- **Dependencies:** Apple SwiftUI, WebKit, WidgetKit, App Intents, and App Groups only. No third-party native packages are introduced.
- **Blast radius:** Tasks web presentation, iOS build assets, and native widget rendering. Other BathOS modules remain unaffected.

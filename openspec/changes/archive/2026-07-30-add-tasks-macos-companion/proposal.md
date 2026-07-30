## Why

BathOS Tasks now has a capable iOS companion and widget, but macOS remains limited to browser and PWA behavior that cannot reliably own system-reserved shortcuts, full-screen Escape handling, or WidgetKit surfaces. A thin native macOS companion can preserve the same web application and task authority while adding the desktop-specific control the user expects.

## What Changes

- Add a native macOS SwiftUI application that hosts the production Tasks web application in a persistent `WKWebView`.
- Keep in-module navigation inside the native container while opening other BathOS modules and external destinations in the user's default application.
- Add native Command+1 through Command+6 view commands and consume unmodified Escape inside the app before macOS can use it to exit full screen, while forwarding Escape to the active Tasks web surface.
- Preserve Tasks deep links, offline WebKit storage, sign-in state, app-bound navigation, widget snapshot capture, and recovery behavior in the macOS container.
- Add a configurable macOS WidgetKit extension for Today, Upcoming, Anytime, and Someday that shares the iOS large-widget presentation, completion action, Primary Link action, snapshot validation, background refresh, and App Group boundary.
- Add a reproducible Xcode build, signing, installation, and verification path for the Mac app and widget without weakening the established iOS targets.
- Present the Mac application as `Tasks` and use the same app, widget, App Group, URL-scheme, and WidgetKit identities as the iOS companion so Apple platforms can recognize them as platform counterparts.
- Keep the native Tasks window eligible for macOS Split View alongside other full-screen applications, including at a narrow mobile-class width.

## Capabilities

### New Capabilities

- `tasks-macos-companion`: Native macOS Tasks container, desktop keyboard ownership, deep links, shared widget behavior, local installation, and signing.

### Modified Capabilities

- `tasks-ios-companion`: The iOS large-widget implementation becomes an explicitly shared Apple-platform surface whose macOS counterpart must remain behaviorally and visually aligned.

## Impact

- Adds a macOS Xcode project, app target, widget extension, tests, entitlements, assets, and installation documentation.
- Reuses bounded widget projection and action code under `ios/TasksCompanion/Shared` and the cross-platform widget renderer under `ios/TasksCompanion/TasksWidgets`.
- Adds macOS-specific SwiftUI, AppKit, and WebKit code without changing Supabase schema, Edge Functions, PowerSync tables, or the authoritative Tasks web data model.
- Uses the existing production origin, App Group, widget action endpoint, custom Tasks URL scheme, app bundle identifier, widget bundle identifier, and WidgetKit kind across iOS and macOS.

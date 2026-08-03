## Why

The shared widget header currently routes every configured list through the generic list-aware creation signal. On Today, that signal can inherit the first visible horizon, so its plus button does not guarantee the same Today Inbox placement as the iOS Control Center action.

## What Changes

- Route the Today large-widget plus button through the explicit Today Inbox native creation route on both iOS and macOS.
- Preserve the existing configured-list creation routes for Upcoming, Anytime, and Someday widgets.
- Retain the iOS Control Center action's explicit Today Inbox route and add regression coverage that keeps the two Today native capture surfaces aligned.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tasks-ios-companion`: Require the Today large-widget plus action and the iOS Control Center action to begin new tasks in Today Inbox.
- `tasks-macos-companion`: Require the macOS Today large-widget plus action to begin new tasks in Today Inbox while preserving configured-list behavior elsewhere.

## Impact

- Shared Apple widget routing policy in `ios/TasksCompanion/Shared/TaskWidgetSnapshot.swift`.
- iOS and macOS companion route regression tests.
- No database, Supabase, authentication, managed-secret, or web API changes.

## Why

The Tasks native web view needs a deliberate recovery command that can bypass stale cached web assets without deleting authentication or offline task data. Ordinary browser refresh shortcuts do not provide a reliable cache-clearing reload inside the native companion.

## What Changes

- Add Command+Option+R to the macOS Tasks companion as a native hard-refresh command.
- Define Control+Alt+R as the equivalent chord for a future Windows native host.
- Clear only reload-safe web caches, preserve cookies, credentials, local storage, IndexedDB, OPFS task data, and widget state, then reload the current Tasks route from its origin.
- Consume the native shortcut so the embedded page and ordinary browser refresh handling do not also run.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tasks-macos-companion`: Add a native cache-clearing web-view reload command with a data-preserving cache boundary and cross-platform shortcut parity.

## Impact

- macOS Tasks keyboard ownership, `WKWebView` cache maintenance, native unit tests, and companion documentation.
- No web module, Supabase, database, PowerSync schema, dependency, iOS behavior, or migration changes.

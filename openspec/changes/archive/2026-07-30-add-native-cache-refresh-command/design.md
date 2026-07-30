## Context

The macOS Tasks companion owns a small set of commands through an `NSEvent` local monitor and hosts the production application in one persistent `WKWebView`. A normal reload may reuse stale WebKit and Cache Storage responses. Clearing the complete `WKWebsiteDataStore`, however, would also remove authentication and the local PowerSync/OPFS database.

## Goals / Non-Goals

**Goals:**

- Give the active macOS Tasks window a dependable Command+Option+R hard-refresh command.
- Clear reload-safe native and web caches before requesting the current route from its origin.
- Preserve authentication, browser storage, offline task data, and widget state.
- Reserve Control+Alt+R as the equivalent command for a future Windows native host.

**Non-Goals:**

- Add the command to ordinary browsers, PWAs, or iOS.
- Clear cookies, credentials, local storage, IndexedDB, OPFS, service-worker registrations, or App Group widget data.
- Add a visible maintenance button or advertise the recovery chord in the ordinary web keyboard panel.

## Decisions

### Own the command in the native keyboard controller

The existing macOS local key monitor will recognize exactly Command+Option+R while the Tasks window is key, consume it, and ask the browser model to perform the refresh. This avoids depending on whether WebKit delivers or reserves the chord.

Alternative considered: listen in React. Rejected because page JavaScript cannot authoritatively clear the native WebKit response caches and the behavior is intended only for native containers.

### Remove only cache-class website data

The refresh will remove WebKit disk cache, memory cache, offline application cache, and Fetch Cache data, and clear `URLCache`. It will not remove cookies, local storage, IndexedDB, service-worker registrations, file-system storage, credentials, or App Group data.

Alternative considered: call `removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes())`. Rejected because it would sign the user out and could erase local-first task state.

### Reload from origin after cache removal completes

After cache removal finishes, the current web-view route reloads with origin-forcing semantics. If the view has not acquired a current URL yet, the model loads its requested Tasks URL with an ignore-cache request policy.

Alternative considered: reload immediately while deletion runs. Rejected because it creates a race in which the new navigation can repopulate or reuse cache entries before removal finishes.

## Risks / Trade-offs

- **Cache removal can briefly make the next load slower.** The user invokes an explicit deep-recovery command, so fetching fresh assets is the intended cost.
- **Clearing Fetch Cache reduces offline readiness until assets are fetched again.** The command is an intentional repair action and preserves the service-worker registration and all durable task data.
- **A future Windows host may use a different embedded-browser cache API.** The Windows chord and preservation boundary are contractual, while the platform implementation may differ.

## Migration Plan

No data migration is required. Rollback removes the shortcut handler and cache-refresh method without touching stored user data.

## Open Questions

None.

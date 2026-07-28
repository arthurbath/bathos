# Tasks iOS Companion Evaluation

## Decision

Use a thin SwiftUI `WKWebView` host plus a read-only WidgetKit extension. Keep the production BathOS Tasks web module authoritative for authentication, synchronization, task editing, projection logic, and access control.

This is the smallest native architecture that supplies configurable Home Screen widgets without duplicating the Tasks domain in Swift.

## Delivered Boundary

- One iOS application target at `garden.bath.tasks`
- One WidgetKit extension at `garden.bath.tasks.widgets`
- One configurable `systemLarge` widget for Today, Upcoming, Anytime, Someday, or Done
- One versioned, bounded web-to-native projection bridge
- One App Group cache at `group.garden.bath.tasks`
- Allowlisted list and task deep links
- Native unit coverage for cache validation and route parsing

Apple Watch complications, native task editing, independent background synchronization, and App Store distribution are outside this slice.

## Data And Privacy

The web application derives widget rows from owner-scoped local task data. Native code accepts bridge messages only from the production Tasks main frame and validates the complete payload before writing it atomically.

Each supported list is limited to 50 rows. The projection includes task identifier, Summary, Deadline, Today horizon, actionability, and terminal state only where relevant. It omits credentials, cookies, tokens, notes, checklist text, Primary Link, Mail provenance, and raw synchronization failures. A different owner replaces the whole cache, and sign-out clears it.

WidgetKit never receives Supabase credentials and does not independently query production. It renders the most recent accepted cache and marks stale data. The companion requests timeline reloads only when the snapshot content changes.

## Deep-Link Boundary

The custom scheme accepts only known Tasks list identifiers or a canonical UUID task identifier. Native code translates accepted routes to HTTPS production Tasks routes. The web application opens a task only after confirming it appears in the current authenticated owner's selected-list projection, then removes the one-time native query parameter.

## Validation

The web projection and deep-link integration are covered by Vitest. The complete web suite, Tasks TypeScript check, lint, production build, and strict OpenSpec validation passed before physical acceptance.

The project also builds through Xcode 27 beta 4 for a generic iOS destination with the checked-in asset catalog, extension embedding, App Intents metadata, and automatic signing intact. The committed project leaves `DEVELOPMENT_TEAM` unset.

On July 28, 2026, automatic signing provisioned the app and extension for the user's private Apple team and the shared `group.garden.bath.tasks` App Group. The signed app and widget installed on an iPhone 16 running iOS 27 with Developer Mode enabled. The physical XCTest action passed seven tests with zero failures, covering:

- all five bounded lists and private-field omissions
- JavaScript ISO 8601 timestamps with fractional seconds
- malformed lists and oversized task rows
- atomic owner replacement and cache clearing
- allowlisted list and task route parsing
- persistent app-bound WebKit configuration
- visible native recovery after failed navigation or WebKit process termination

The fractional-second test closes a physical acceptance defect discovered after the production bridge went live. JavaScript `Date.toISOString()` generated a value such as `2026-07-28T10:37:45.123Z`, while the original Swift validator accepted only whole-second internet timestamps. The corrected validator accepts both forms, and the signed companion then accepted and stored the real owner-scoped snapshot.

Physical rendered acceptance has proved:

- authenticated sign-in and session persistence
- default Today launch
- all five widget choices through the native editor: Today, Upcoming, Anytime, Someday, and Done
- live task counts, bounded rows, truncation messaging, Today horizon colors, terminal icons, and Someday dashed checkboxes
- cold and running list links
- a cold task-row link that opened the selected owner-visible task
- App Group access by both signed targets

## Offline Acceptance Findings

The first physical Airplane Mode widget launch exposed two independent offline-shell gaps:

1. The native wrapper had not declared the trusted production host in `WKAppBoundDomains` or limited the persistent web view to app-bound navigation. WebKit therefore did not expose service-worker behavior to the wrapper, and the launch left a white web surface.
2. After that native policy was corrected and the app reported `Offline Launch: Ready`, the cached black BathOS document loaded, but the Tasks application remained absent. Production inspection showed that Vite's generated preload table requests lazy dependencies from root `/assets/` paths, while the offline shell stores them under `/tasks-offline-assets/`. Worker and WASM children can also resolve into one duplicated `/tasks-offline-assets/assets/assets/` path.

The release candidate declares only `os.bath.garden` as app-bound, keeps external links in the operating system, and resets the native loaded state after failed navigation or WebKit process termination. Service-worker format 6 and registration version 9 added root-preload fallback and normalized the generated nested worker-asset path, but the physical app then remained on its centered startup spinner because WebKit did not promptly reject the disconnected network-first preload request. Service-worker format 7 and registration version 10 therefore serve only exact, content-hashed assets already present in the active complete Tasks shell cache-first; cache misses, uncached shared assets, and non-Tasks data APIs retain their ordinary network path. Focused production-shaped coverage proves the cached root preload does not call the network, nested worker/WASM resolution, unrelated API pass-through, reminder registration, and atomic shell replacement. Physical Airplane Mode acceptance remains required after this candidate is published.

## Widget Configuration Compatibility

Interactive acceptance on iOS 26.5 exposed a WidgetKit parameter-decoding regression. SpringBoard persisted the selected `AppEntity` identifier, but the timeline provider still received the default Today entity. Host configuration and timeline archives proved the mismatch independently.

The widget now uses a finite `DynamicOptionsProvider` backed by primitive string values. The user still sees exactly Today, Upcoming, Anytime, Someday, and Done, and the provider maps those values to the existing allowlisted identifiers. Timeline-provider logs and rendered widgets prove all five choices on both iOS 26.5 and iOS 26.4. This changes only configuration transport, not the cache, privacy, rendering, or deep-link contracts.

## Remaining Acceptance

1. Prove the companion's already-cached web shell and the widget remain usable during a physical Airplane Mode launch.
2. Sign out once, prove the widget removes the prior owner's rows, then sign back in and prove the cache repopulates.

The OpenSpec change should remain active until this physical-device acceptance is complete.

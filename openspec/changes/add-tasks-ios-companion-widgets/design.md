## Context

BathOS Tasks is a mature React/PowerSync web application with offline operation, owner-scoped synchronization, and production routes at `https://os.bath.garden/tasks/*`. Its prior native-Apple decision gate intentionally deferred native work until a concrete native-only gap emerged. The requested configurable Home Screen task-list widget now satisfies that gate.

The companion must remain a host for the web product, not become a second task client. WidgetKit renders extensions in a separate process and cannot render a `WKWebView`, so the widget needs a bounded native representation of the existing web projection. Initial implementation began before an eligible Apple Development team and physical-device configuration were available. The user subsequently configured Xcode automatic signing, App Group provisioning, Developer Mode, and the intended iPhone, allowing the signed app, extension, shared cache, native tests, and widget behavior to be validated without committing Apple account identity.

## Goals / Non-Goals

**Goals:**

- House the production Tasks web UI in the smallest practical SwiftUI and `WKWebView` app.
- Preserve the web module as the only editing, synchronization, authentication, and reminder implementation.
- Provide a configurable `systemLarge` Home Screen widget that can show Today, Upcoming, Anytime, Someday, or Done.
- Project all supported lists from the authenticated local PowerSync data already loaded by the web app.
- Keep task data owner-scoped and prevent one signed-in account's cached rows from surviving an account change.
- Deep-link a widget or widget row to its corresponding Tasks route.
- Produce a dependency-free Xcode project that builds with Apple SDKs and can be configured for automatic signing.
- Leave a clear extension seam for later widget families, App Intents, native notifications, or an Apple Watch count complication.

**Non-Goals:**

- Reimplementing task editing, offline mutation, synchronization, recurrence, reminders, or search in Swift.
- Giving the widget mutation controls in the first delivery.
- Copying Supabase access tokens, refresh tokens, passwords, cookies, or PowerSync credentials into the App Group.
- Adding a native background authentication client or server-side widget endpoint.
- Guaranteeing immediate widget updates while the containing app has not run since another device changed data.
- Shipping through TestFlight or the App Store without a configured Apple Developer team.
- Building the aspirational Apple Watch complication in the first delivery.

## Decisions

### Use a thin SwiftUI WebKit container

The main target contains a single observable browser model and `WKWebView` wrapper. It loads `https://os.bath.garden/tasks/today`, preserves normal web authentication and offline behavior, restricts privileged bridge messages to the trusted main frame, and opens unrelated external URLs outside the companion.

This is preferred over a native task client because it preserves one UI, one task-domain implementation, one offline database, and one release cadence. A native PowerSync client was rejected for this phase because it would duplicate substantial domain behavior and require its own convergence matrix.

The app declares only `os.bath.garden` in `WKAppBoundDomains` and configures the persistent Tasks web view to limit top-level navigation to that domain. This is required for WebKit to expose service workers to a native wrapper, allowing the existing Tasks offline shell to be staged and served from the same persistent browsing partition. External destinations never enter that restricted web view; the navigation delegate continues handing them to the operating system. A failed top-level navigation or terminated web-content process also resets the native presentation state so an unrecoverable load shows the native unavailable treatment instead of a blank surface.

The cached shell stores the complete discovered Tasks asset graph under a dedicated offline URL namespace. Generated Vite preload tables can still request the same versioned files from their original root `/assets/` URLs, and worker code can resolve an `assets/` child beneath the offline namespace. The service worker therefore keeps online asset traffic network-first but falls back to the corresponding staged response when disconnected, and normalizes that one generated nested-asset form. It does not generically cache arbitrary responses or intercept non-Tasks data APIs.

### Publish a bounded projection instead of credentials

The Tasks web module performs one owner-scoped local query covering active and retained terminal task rows, derives the five supported list projections with the same domain predicates and ordering helpers used by list views, bounds each list, and posts a versioned JSON message only when the WebKit handler exists.

The payload contains:

- schema version and generation timestamp
- current owner identifier solely for cache replacement
- planning date
- list identifier and display title
- bounded task rows containing task identifier, summary, optional deadline, optional Today horizon, actionability, and terminal state
- total count and truncation state

It never contains notes, primary links, checklist text, reminder credentials, mail-source metadata, Supabase tokens, PowerSync credentials, or secrets. The native app atomically replaces the complete cache in the App Group and clears it on explicit web sign-out or owner change.

Web generation timestamps use JavaScript ISO 8601 formatting, including fractional seconds. Native validation accepts both fractional and whole-second internet timestamps so the bridge contract does not reject a standards-compliant `Date.toISOString()` value.

This approach is preferred over copying a Supabase session to native Keychain because the latter creates a second authenticated data client and a materially larger security and maintenance surface. It is also preferred over DOM scraping because the projection remains typed, testable, and independent of presentation markup.

### Keep widget configuration finite and stable

The WidgetKit extension uses `AppIntentConfiguration` with a finite `DynamicOptionsProvider` for Today, Upcoming, Anytime, Someday, and Done. The parameter persists a primitive list title and maps it back to the existing allowlisted list identifier. This avoids an iOS 26.5 WidgetKit regression in which an `AppEntity` selection is persisted correctly by SpringBoard but the timeline provider receives the default entity. The first widget supports `.systemLarge`, matching the requested large Home Screen surface. The data model and view remain family-aware so later medium, Lock Screen, or watchOS surfaces can be added without changing the cache contract.

The widget reads only the App Group snapshot. It displays the configured list name, visible count, bounded summaries, an empty state, or a signed-out/not-yet-synchronized state. The system's default redaction and widget privacy behavior remain intact.

### Treat widgets as cached, budgeted surfaces

The app calls `WidgetCenter.reloadTimelines` after accepting a changed projection. The provider also requests a conservative later refresh so it can re-read the shared cache and update relative freshness presentation. This does not claim minute-level or real-time refresh: WidgetKit controls execution and applies a daily refresh budget.

When the containing app is active, task mutations and synchronized changes flow through PowerSync into the web projection and then into the widget cache. If another device changes data while the companion never runs, the widget can remain stale until iOS next runs the app or the user opens it. A later server-backed native refresh path requires its own explicit security and production-deployment change.

### Use App Groups for extension-safe storage

The app and extension use `group.garden.bath.tasks` and atomically read and write one JSON snapshot file in the shared container. Bundle identifiers are `garden.bath.tasks` and `garden.bath.tasks.widgets`. Both targets declare the App Group entitlement, but the project leaves `DEVELOPMENT_TEAM` unset and uses automatic signing so the user's Apple team can be selected in Xcode without committing account identity.

### Use a private custom scheme for deterministic deep links

`bathostasks://list/<view>` opens the configured list. A row may use `bathostasks://task/<id>?list=<view>`, which loads the list route with a bounded `native_task` query parameter. The web module opens that task only if it is visible to the authenticated owner in the current projection; otherwise it leaves the list open.

A custom scheme avoids requiring an Associated Domains deployment for the initial private companion. Universal links remain a later compatibility improvement.

### Keep the Xcode project dependency-free

The native project uses only SwiftUI, WebKit, WidgetKit, AppIntents, and Foundation. It does not depend on CocoaPods, Swift Package dependencies, XcodeGen, or Tuist. This makes the checked-in project reproducible on the installed Xcode without adding a package manager or network dependency.

## Risks / Trade-offs

- **Cached widgets can lag behind changes made elsewhere while the app never runs** -> Label the snapshot's update time accessibly, refresh immediately whenever the app receives a projection, and keep server-backed refresh as a separately approved capability.
- **App Group provisioning is unavailable without suitable Apple account capability and signing state** -> Keep team identity out of source control, prove unsigned simulator compilation, and document the one-time automatic-signing and App Group registration steps.
- **A malformed or hostile page could try to send bridge messages** -> Accept messages only from the main frame while its URL uses the trusted production origin, decode a strict schema, cap lists and string lengths, and atomically replace rather than merge payloads.
- **A stale account cache could expose another owner's task summaries** -> Carry an owner marker, replace the entire cache on owner change, clear on sign-out, and never merge different owners.
- **Widget task titles are visible on the Home Screen** -> This is an explicit user-installed surface; keep detailed notes, links, and private source metadata out of the snapshot and allow normal iOS widget privacy/redaction.
- **Custom schemes are not verified domains** -> Use them only as local navigation hints, never as authorization, and validate task visibility after web authentication.
- **Manual Xcode project files are harder to maintain than generated projects** -> Keep two small targets, centralize shared files, and add a project-integrity build test; reconsider generation only if native scope materially grows.
- **WebKit wrappers do not receive service-worker offline support automatically** -> Declare only the trusted Tasks host as app-bound, opt the persistent web view into that policy, verify offline readiness before disconnecting, and retain a native failure surface when neither network nor cached shell can satisfy navigation.

## Migration Plan

1. Add and validate the OpenSpec contract.
2. Add the web projection builder, WebKit bridge publisher, sign-out clearing, and bounded native-task deep-link handling behind feature detection.
3. Add the iOS app, App Group cache model, route model, WebKit host, widget intent/provider/view, entitlements, assets, and unit tests.
4. Build the app and widget for a generic iOS Simulator with signing disabled; run Swift and web tests.
5. On a Mac with a healthy Simulator service, install and exercise the app and configurable large widget.
6. Select the user's Apple Development team, register both App IDs and `group.garden.bath.tasks`, then run on the user's iPhone.
7. Roll back by removing the native targets and bridge publisher; the ordinary web Tasks module continues unchanged because bridge publication is feature-detected and side-effect free.

No database migration, production Supabase deployment, PowerSync topology change, or secret rotation is required.

## Open Questions

- Whether lived use later justifies TestFlight or App Store distribution instead of the accepted direct Xcode installation.
- Whether lived use later justifies background server refresh, additional widget families, interactive widget actions, native notification delivery, or an Apple Watch count complication.

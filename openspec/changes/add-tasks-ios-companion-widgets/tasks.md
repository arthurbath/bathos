## 1. Contract And Web Projection

- [x] 1.1 Add a versioned bounded Tasks widget projection model and derive all five supported list snapshots from owner-scoped local data
- [x] 1.2 Publish changed snapshots and cache-clear events only through a detected native WebKit bridge
- [x] 1.3 Add allowlisted native task deep-link handling that opens only a task visible to the authenticated owner
- [x] 1.4 Cover projection bounds, privacy omissions, ordering, browser no-op behavior, sign-out clearing, and deep-link visibility with Vitest

## 2. Native Shared Domain

- [x] 2.1 Add the dependency-free iOS project, stable bundle identifiers, App Group entitlements, privacy-safe configuration, and checked-in Tasks app assets
- [x] 2.2 Implement strict shared snapshot decoding, bounds enforcement, owner replacement, atomic App Group persistence, content-difference detection, and cache clearing
- [x] 2.3 Implement allowlisted custom-scheme route parsing and production web-route generation
- [x] 2.4 Cover snapshot validation, account replacement, and route fallbacks with native unit tests

## 3. iOS Web Host

- [x] 3.1 Implement the SwiftUI WebKit host, trusted-origin navigation policy, external-link handoff, loading and offline presentation, and default Today launch
- [x] 3.2 Implement the main-frame script-message handler and reload WidgetKit only after accepted content changes
- [x] 3.3 Handle list and task deep links in cold and running app states

## 4. Configurable Widget

- [x] 4.1 Implement the App Intent list configuration for Today, Upcoming, Anytime, Someday, and Done
- [x] 4.2 Implement the system-large timeline provider and dark BathOS list rendering for populated, empty, truncated, stale, and signed-out states
- [x] 4.3 Wire list and row links to the companion's allowlisted routes and retain system privacy redaction

## 5. Validation And Handoff

- [x] 5.1 Run targeted and full web tests, TypeScript, lint, and production build validation
- [x] 5.2 Build the iOS app and widget for a generic simulator with signing disabled and run native tests wherever local Apple services permit
- [x] 5.3 Inspect signing identities and Simulator health, repair safe local service issues where possible, and document any external Apple account or device gates
- [x] 5.4 Update BathOS architecture, Tasks guidance, README, and a dated native-companion evaluation with build and privacy boundaries
- [ ] 5.5 Run `openspec validate --all --strict`, sync and archive the change only when implementation tasks are complete, then commit, push, and prove `main` is clean and synchronized
- [ ] 5.6 Perform an on-device acceptance pass proving sign-in, offline web launch, configurable large widgets for supported lists, cache clearing, and deep links after an eligible Apple team provisions the App Group

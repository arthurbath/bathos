## 1. Server Authority

- [x] 1.1 Add private widget push registrations and generation-aware owner invalidation outbox tables
- [x] 1.2 Add credential-bound registration and service-only claim, acknowledgement, retry, and token-retirement RPCs
- [x] 1.3 Add projection-input triggers that enqueue owner invalidations
- [x] 1.4 Extend `tasks-widget-actions` with validated push token registration
- [x] 1.5 Add the authenticated APNs WidgetKit dispatcher and deployment documentation

## 2. Native Widget Clients

- [x] 2.1 Add shared App Group pending-registration storage and registration client behavior
- [x] 2.2 Attach an availability-gated WidgetKit push handler to iOS and macOS list widgets
- [x] 2.3 Attach an availability-gated WidgetKit push handler to the watch complication
- [x] 2.4 Add push entitlements and environment/topic configuration to native widget targets
- [x] 2.5 Use the platform-specific macOS APNs entitlement key and verify it survives signed provisioning
- [x] 2.6 Reconcile persisted token registrations with the signed build's APNs environment after upgrades
- [x] 2.7 Reconcile WidgetKit's current push information during list-widget timeline generation when the token callback is delayed or missed
- [x] 2.8 Keep direct signed macOS installations on the APNs sandbox environment that matches their Apple Development provisioning profile
- [x] 2.9 Reconcile the authoritative widget snapshot when native Tasks content becomes ready or the host app becomes active
- [x] 2.10 Order bounded Upcoming widget rows by controlling date before Upcoming rank on both server and foreground bridge paths
- [x] 2.11 Omit titleless legacy task records from server and foreground widget snapshot projections
- [x] 2.12 Keep the native Primary Link wire kind limited to `mail` and `link`; derive Jira and Obsidian presentation from the href in native code

## 3. Verification

- [x] 3.1 Add database tests for registration isolation, coalescing, generation-safe acknowledgement, and authorization
- [x] 3.2 Add Edge Function tests for registration validation, APNs dispatch outcomes, and retries
- [x] 3.3 Add native tests for pending registration, credential-late retry, token rotation, and disablement
- [x] 3.4 Run targeted native, Edge Function, database, build, lint, and OpenSpec validation checks
- [x] 3.5 Document the production migration, managed APNs secrets, bounded smoke test, and scheduler enablement without deploying them
- [x] 3.6 Add regression coverage for host reconciliation and true next-Upcoming ordering, then verify the repaired live snapshot before replacing native artifacts
- [x] 3.7 Add server and foreground regressions proving a titleless task cannot invalidate the shared snapshot
- [x] 3.8 Add database regression coverage proving Jira and Obsidian destinations serialize with the native `link` wire kind

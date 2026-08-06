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

## 3. Verification

- [x] 3.1 Add database tests for registration isolation, coalescing, generation-safe acknowledgement, and authorization
- [x] 3.2 Add Edge Function tests for registration validation, APNs dispatch outcomes, and retries
- [x] 3.3 Add native tests for pending registration, credential-late retry, token rotation, and disablement
- [x] 3.4 Run targeted native, Edge Function, database, build, lint, and OpenSpec validation checks
- [x] 3.5 Document the production migration, managed APNs secrets, bounded smoke test, and scheduler enablement without deploying them

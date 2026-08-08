## 1. Database Contracts

- [x] 1.1 Add private native token storage with owner, installation, platform, environment, and topic constraints
- [x] 1.2 Add authenticated native target registration and revocation RPCs
- [x] 1.3 Add service-role native delivery claim and provider-result RPCs
- [x] 1.4 Add a versioned in-app claim RPC with a session lower bound and preserve legacy compatibility
- [x] 1.5 Add pgTAP coverage for owner isolation, idempotency, session bounds, retries, and permanent revocation

## 2. Dispatcher

- [x] 2.1 Extend the reminder dispatcher to claim and send APNs alert notifications alongside Web Push
- [x] 2.2 Validate APNs platform, environment, topic, token, payload, and provider failure classification
- [x] 2.3 Add dispatcher tests for accepted, transient, permanent, partial, and unconfigured native delivery
- [x] 2.4 Update deployment documentation and verification for the reused APNs managed secrets

## 3. Web Reminder Runtime

- [x] 3.1 Register and revoke native tokens through the authenticated reminder service
- [x] 3.2 Pass the current Tasks session lower bound to every in-app fallback claim
- [x] 3.3 Add tests proving stale reminders never appear and current-session reminders remain stackable and acknowledgeable

## 4. Native Companions

- [x] 4.1 Add application push entitlements and environment metadata to iOS and macOS builds
- [x] 4.2 Register each authorized companion for remote notifications and bridge token lifecycle to the authenticated Tasks surface
- [x] 4.3 Present foreground native alerts and deep-link activated APNs reminders through the existing task route
- [x] 4.4 Preserve local notification reconciliation as an app-owned fallback and add Swift tests

## 5. Validation and Rollout

- [x] 5.1 Run focused Vitest, Swift, and pgTAP reminder suites
- [x] 5.2 Run full lint, test, build, database lint, database tests, and strict OpenSpec validation
- [x] 5.3 Apply the migration, deploy the dispatcher, and verify production registration and provider acceptance before native rebuilds

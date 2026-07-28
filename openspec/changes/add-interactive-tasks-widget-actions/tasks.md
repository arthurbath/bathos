## 1. Contract and Database Boundary

- [x] 1.1 Validate the OpenSpec proposal, design, and delta specifications before implementation
- [x] 1.2 Create the private widget credential migration with restricted issue, complete, and revoke RPCs
- [x] 1.3 Add database tests for owner binding, hashing, rotation, expiry, revocation, idempotency, lifecycle history, recurrence, and zero foreign-task mutation
- [x] 1.4 Prove the new private objects are absent from PowerSync and preserve exactly 20 approved Tasks tables

## 2. Edge Function Boundary

- [x] 2.1 Implement the `tasks-widget-actions` issue, complete, and revoke request handler with bounded inputs, content-free errors, and no secret logging
- [x] 2.2 Add focused handler tests for Supabase-user validation, widget credential validation, accepted completion, retry, rejection, timeout, and revocation
- [x] 2.3 Register the function configuration and document its managed-secret and deployment requirements

## 3. Web Projection and Credential Provisioning

- [x] 3.1 Upgrade the native bridge and snapshot to schema version 2 with normalized Primary Link kind and href
- [x] 3.2 Inject and validate one stable native installation identifier without affecting ordinary browsers
- [x] 3.3 Provision and rotate the narrow widget credential only in an authenticated trusted companion session, pass it through memory to the native bridge, and clear it on sign-out
- [x] 3.4 Extend web tests for supported and unsupported Primary Links, ordinary-browser no-op behavior, credential messages, owner changes, and cache clearing

## 4. Native Interactive Widget

- [x] 4.1 Add protected App Group credential and installation-identity storage with strict schema and size validation
- [x] 4.2 Add an App Intent completion client that never opens the app, uses a short timeout and idempotency key, and fails closed
- [x] 4.3 Reconcile successful completion into the local snapshot after a brief pause and reload WidgetKit timelines
- [x] 4.4 Split widget rows into independent completion, task-summary, and optional direct Primary Link actions with accessible Mail and link iconography
- [x] 4.5 Add native tests for credential persistence, URL validation, independent action routing, successful reconciliation, retry, and failure retention
- [x] 4.6 Harden physical Toggle invocation, transient retry, and resident companion deep-link runtime continuity

## 5. Validation and Controlled Rollout

- [x] 5.1 Run focused database, Edge Function, web, and native tests
- [x] 5.2 Run the complete database and application suites, TypeScript, lint, production build, unsigned iOS build/tests, and strict OpenSpec validation
- [x] 5.3 Document exact production preflight, data effects, secrets, rollback, and the approval prompt without mutating production
- [ ] 5.4 After explicit approval, refresh and verify the private backup, apply the migration, deploy the Edge Function, publish the web release, reinstall the signed companion, and run and clean up the owner-scoped fixture
- [ ] 5.5 Prove physical checkbox completion, direct Primary Link activation, cross-client convergence, PowerSync, cron, advisors, production parity, and repository synchronization
- [ ] 5.6 Reinstall the incident-hardened companion and prove failed/retried completion cannot strand the app on an indefinite spinner

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
- [x] 3.5 Retry transient native credential issuance until the current authenticated companion receives its owner-and-installation-bound credential

## 4. Native Interactive Widget

- [x] 4.1 Add protected App Group credential and installation-identity storage with strict schema and size validation
- [x] 4.2 Add an App Intent completion client that never opens the app, uses a short timeout and idempotency key, and fails closed
- [x] 4.3 Reconcile successful completion into the local snapshot after a brief pause and reload WidgetKit timelines
- [x] 4.4 Split widget rows into independent completion, task-summary, and optional direct Primary Link actions with accessible Mail, Jira, Obsidian, and generic link iconography
- [x] 4.5 Add native tests for credential persistence, URL validation, independent action routing, successful reconciliation, retry, and failure retention
- [x] 4.6 Harden physical Toggle invocation, transient retry, and resident companion deep-link runtime continuity
- [x] 4.7 Add a fixed ten-task large-widget cap without overflow messaging and a bounded list-aware header capture route
- [x] 4.8 Diagnose and repair missing completion authority in the shared macOS widget without changing its narrow server scope

## 5. Validation and Controlled Rollout

- [x] 5.1 Run focused database, Edge Function, web, and native tests
- [x] 5.2 Run the complete database and application suites, TypeScript, lint, production build, unsigned iOS build/tests, and strict OpenSpec validation
- [x] 5.3 Document exact production preflight, data effects, secrets, rollback, and the approval prompt without mutating production
- [x] 5.4 After explicit approval, refresh and verify the private backup, apply the migration, deploy the Edge Function, publish the web release, reinstall the signed companion, and run and clean up the owner-scoped fixture
- [ ] 5.5 Prove physical checkbox completion, direct Primary Link activation, cross-client convergence, PowerSync, cron, advisors, production parity, and repository synchronization
- [x] 5.6 Reinstall the incident-hardened companion and prove failed/retried completion cannot strand the app on an indefinite spinner
- [ ] 5.7 Reinstall the refined companion and physically verify the ten-task cap without overflow messaging and the configured-list header capture action

## 6. List-Specific Widget Row Context

- [x] 6.1 Extend the bounded schema-version-2 projection with optional authoritative Upcoming display-date and recurrence-projection fields while preserving legacy snapshot compatibility
- [x] 6.2 Render canonical colored Today horizon symbols and compact Upcoming weekday-or-date chips in the shared iOS and macOS widget row
- [x] 6.3 Replace the Upcoming recurrence projection checkbox with a noninteractive recurrence symbol
- [x] 6.4 Reduce only the macOS large-widget row minimum height by one point
- [x] 6.5 Add focused web and native tests for projection, validation, date-label thresholds, recurrence protection, and platform row density
- [x] 6.6 Run focused tests, TypeScript, lint, production build, native builds/tests, and strict OpenSpec validation

## 1. Contract and database boundary

- [x] 1.1 Validate the new OpenSpec proposal, design, and delta specification before implementation
- [x] 1.2 Create an additive migration for the service-role-only credential-authenticated widget snapshot function
- [x] 1.3 Add database tests for owner isolation, credential lifecycle, list membership and ordering, durable preferences, bounded output, field redaction, and PowerSync exclusion
- [x] 1.4 Update the active interactive-widget contract and documentation so the existing native credential explicitly permits bounded snapshot reads and completion only

## 2. Edge Function boundary

- [x] 2.1 Extend `tasks-widget-actions` with the credential-authenticated `snapshot` action and content-free failure responses
- [x] 2.2 Add handler tests for successful snapshot reads, invalid credentials, RPC failures, and response validation
- [x] 2.3 Update the Edge Function deployment documentation without introducing a new managed secret

## 3. Native background refresh

- [x] 3.1 Add a bounded native snapshot client with credential validation, short timeout, one transient retry, response validation, and owner matching
- [x] 3.2 Refresh and atomically cache the projection during asynchronous WidgetKit timeline generation while retaining the last valid cache on every failure
- [x] 3.3 Remove the stale “Open Tasks to Refresh” presentation and keep first-use authentication guidance
- [x] 3.4 Add native tests for successful background refresh, offline fallback, invalid or cross-owner responses, retry, and cache preservation

## 4. Validation and rollout preparation

- [x] 4.1 Run focused database, Edge Function, and native tests
- [x] 4.2 Run the complete database and application suites, TypeScript, lint, production build, unsigned iOS build/tests, and strict OpenSpec validation
- [x] 4.3 Document exact production preflight, migration effects, deployment order, rollback, owner-scoped acceptance fixture, and approval request without mutating production

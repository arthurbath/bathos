## 1. Reliability Domain and Storage

- [x] 1.1 Add the bounded Tasks synchronization-health states and a deterministic classifier for local, transfer-error, offline, connecting, first-sync, active-transfer, and healthy conditions.
- [x] 1.2 Add the local-only content-free health-episode table, parser, transactional store, multi-tab deduplication, and 50-row retention boundary.

## 2. Runtime Observation and Reporting

- [x] 2.1 Mount one Tasks runtime observer that opens, changes, resolves, and resumes health episodes from live PowerSync status.
- [x] 2.2 Add the 2-minute report threshold and once-per-episode Sentry warning with fixed copy and allowlisted bounded tags.
- [x] 2.3 Expose full-sync completion and recent health episodes through the Tasks diagnostics hook without raw errors or task data.

## 3. Product Surface and Verification

- [x] 3.1 Withhold the `Synced` label before the first full synchronization and show health/recovery evidence in Synchronization Details.
- [x] 3.2 Add focused classifier, store, observer, Sentry privacy, diagnostics, schema, and UI tests.
- [x] 3.3 Update the Tasks guide and add a dated production-reliability evaluation that distinguishes the closed historical reminder incident from current sync evidence.

## 4. Validation and Closeout

- [x] 4.1 Run focused Tasks tests and `npm run typecheck:tasks`.
- [x] 4.2 Run `npm run lint`, `npm run build`, `npm run test`, and `npm run spec:validate`.
- [x] 4.3 Verify the production Safari surface remains healthy after publication without creating personal task content.
- [x] 4.4 Sync the delta specification, archive the completed change, commit, push, and verify a clean synchronized repository.

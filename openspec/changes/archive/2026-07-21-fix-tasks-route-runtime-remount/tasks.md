## 1. Stable Route Boundary

- [x] 1.1 Add the implemented area-detail path and an exact supported-Tasks-path matcher to the shared Tasks route catalogue.
- [x] 1.2 Replace sibling Tasks route elements with one guarded wildcard route and reset DataGrid history internally instead of key-remounting the application subtree, so supported internal navigation preserves the mounted Tasks runtime.
- [x] 1.3 Preserve the `/tasks` Today redirect and normal not-found behavior for unknown Tasks paths.

## 2. Regression Coverage

- [x] 2.1 Add router-level tests proving Today, Inbox, project-detail, and area-detail navigation keeps one Tasks subtree mounted without cleanup.
- [x] 2.2 Add router-level coverage proving an unknown Tasks path leaves the Tasks subtree and reaches Not Found.
- [x] 2.3 Run focused routing and Tasks tests plus Tasks typecheck.

## 3. Validation and Production Acceptance

- [x] 3.1 Run the full test suite, lint, production build, and strict OpenSpec validation.
- [x] 3.2 Commit and push the validated change, then verify a clean synchronized repository.
- [x] 3.3 After publication, verify representative production Safari navigation remains Synced, keeps reminder health, renders area details, and preserves unknown-route handling.
- [x] 3.4 Record production evidence, sync the durable Tasks spec, and archive the completed change.

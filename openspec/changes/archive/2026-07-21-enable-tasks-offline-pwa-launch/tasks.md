## 1. Service-Worker Registration

- [x] 1.1 Add one idempotent Tasks service-worker registration helper with secure-context and capability guards.
- [x] 1.2 Register the worker from the authenticated Tasks runtime without requesting notification permission or creating a push subscription.
- [x] 1.3 Reuse the same registration from Web Push enablement and preserve passive subscription inspection, revocation, and sign-out behavior.
- [x] 1.4 Add focused tests proving registration, unsupported-client isolation, repeated-call reuse, and zero implicit notification work.

## 2. Offline Application Shell

- [x] 2.1 Add complete-shell staging with an HTML-derived version, versioned asset discovery, a content-free active-cache pointer, and failed-stage cleanup.
- [x] 2.2 Extend install and activate handling to precache Tasks, claim clients, preserve the active complete shell, and remove abandoned Tasks caches.
- [x] 2.3 Add network-first `/tasks/*` navigation with offline fallback and a reserved namespace for assets referenced only by cached offline HTML.
- [x] 2.4 Prove unrelated BathOS navigation, API traffic, non-GET requests, task data, credentials, and provider traffic are never intercepted or cached.
- [x] 2.5 Preserve push display, safe notification routing, active push subscriptions, and immediate backward-compatible worker activation.

## 3. Validation and Documentation

- [x] 3.1 Extend service-worker tests for successful staging, atomic failed refresh, offline launch, asset fallback, cache cleanup, and isolation.
- [x] 3.2 Run Tasks-focused tests, the complete suite, lint, production build, and strict OpenSpec validation.
- [x] 3.3 Complete a local real-browser online load, offline relaunch, local mutation, restart, and reconnection acceptance gate without personal data.
- [x] 3.4 Update the Tasks guide and readiness evaluation with the exact first-load and iPhone PWA acceptance contract.
- [x] 3.5 Pause administrator-role probes during browser-offline state, add bounded online retry backoff, and make browser connectivity override stale shared-worker sync status.
- [x] 3.6 Add focused tests for offline probe suppression, reconnect resumption, and truthful offline synchronization state; then rerun validation.
- [x] 3.7 Retain the permanent Tasks manifest and expose partition-local offline-shell readiness in synchronization diagnostics, with focused installation-state tests.

## 4. Production Acceptance

- [x] 4.1 Commit, push, and publish the validated worker through the normal BathOS deployment path.
- [x] 4.2a Verify authenticated production Safari installs worker version 6, refreshes the complete shell, returns to synchronized operation, and retains notification permission and its active Web Push subscription.
- [x] 4.2b Verify authenticated production Chrome cold-reloads the cached Tasks shell and local database under DevTools Offline emulation without disconnecting the Codex host.
- [x] 4.2c Publish the offline retry/status hardening and repeat the Chrome offline pass, confirming bounded remote probes and documenting that DevTools does not isolate the PowerSync shared-worker transport.
- [x] 4.2d Publish worker version 7 through a versioned registration URL and verify authenticated Safari and Chrome report `Synced`, `Offline Launch: Ready`, zero pending changes, and no current console errors.
- [x] 4.3 Complete the user-assisted iPhone Home Screen installation, offline restart, queued mutation, reconnection, and notification-delivery pass.
- [x] 4.4 Sync the durable specification, archive the change, validate the final repository, commit, and push.

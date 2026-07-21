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

## 4. Production Acceptance

- [x] 4.1 Commit, push, and publish the validated worker through the normal BathOS deployment path.
- [ ] 4.2 Verify production Safari installs the new worker, refreshes the shell, retains Web Push, and can reopen Tasks with the network unavailable.
- [ ] 4.3 Complete the user-assisted iPhone Home Screen installation, offline restart, queued mutation, reconnection, and notification-delivery pass.
- [ ] 4.4 Sync the durable specification, archive the change, validate the final repository, commit, and push.

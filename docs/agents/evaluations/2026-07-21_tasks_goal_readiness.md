# Tasks Goal Readiness Audit

**Date:** 2026 Jul 21
**Category:** Product / Production / Trust
**Status:** Final Offline Launch and Bounded Trial Acceptance in Progress

## Outcome

BathOS Tasks satisfies the implemented V1 contract across the web application, offline synchronization, production PowerSync, MCP, Raycast capture, Mail capture, Web Push reminders, recovery, accessibility, and large-library behavior. The module is available for personal parallel use while Things remains authoritative. A final audit identified that durable task data alone did not guarantee an installed PWA could cold-launch its application shell without a network connection. That offline-launch gap is now implemented, published, and accepted in local and isolated production browsers under the active `enable-tasks-offline-pwa-launch` change. Its remaining gates are a literal disconnected relaunch in the authenticated Safari installation and the user-assisted iPhone pass.

The remaining completion gates are the calendar-bound Inbox Manager trial and production acceptance of the new offline PWA shell. Inbox Manager's approved 24-hour or 10-accepted-task parallel trial remains healthy and must reach one boundary before its final production evidence can be recorded and its OpenSpec change can be archived.

## Accepted Product Surfaces

- The dark, mobile-first Tasks module provides Inbox, Today, Upcoming, Anytime, Someday, Logbook, Trash, areas, projects, headings, checklist items, templates, recurrence, reminders, search, bulk planning, undo, export, restore, and recoverable history without tags.
- One stable `/tasks/*` runtime preserves synchronization, notification state, local history, and pending work across supported route changes while invalid Tasks routes render the ordinary 404 boundary.
- PowerSync Cloud uses the exact approved 22-table owner-scoped projection. Production topology, restart, conflict, owner-isolation, cleanup, and cross-client convergence gates passed.
- Safari Web Push subscription, provider acceptance, notification opening, acknowledgement, expired-target revocation, and scheduled reminder dispatch passed in production.
- Raycast supports ordinary Inbox capture, current-browser-page capture, Finder-item capture, and AI-refined reading capture through OAuth and the production MCP function. Unreliable selected-text capture was removed from the product contract.
- Inbox Manager creates Things tasks first and conditionally mirrors only accepted new creations into BathOS Tasks during the private bounded trial. Existing tasks, edits, completions, and Mail rules remain outside that handoff.
- Native Apple surfaces and migration from Things remain deliberate future decisions rather than incomplete V1 obligations.

## Current Production Evidence

- The production MCP service advertises 42 tools, including 33 Tasks operations covering bounded reads, structured creation, updates, movement, ordering, lifecycle transitions, templates, recurrence, reminders, and Mail retirement.
- A read-only production MCP query for Today on 2026 Jul 21 returned five current to-dos, including four Mail-automation tasks, with no truncation or service error.
- The installed Inbox Manager runtime is healthy. Five tasks have been accepted since the current trial began, five accepted-task slots remain, the handoff queue is empty, and no handoff failure is recorded. The latest accepted handoff completed at 2026 Jul 21 3:49 PM PDT, and the scheduled Mail workflow remained healthy through its 3:54 PM run.
- The current trial began at 2026 Jul 21 1:50 PM PDT and expires at 2026 Jul 22 1:50 PM PDT unless the tenth accepted task ends it first.
- The Mail workflow recovered from one stale enrichment-incident record without changing Mail rules, private mode, accepted task receipts, or scheduled success semantics. Two subsequent ordinary scheduled runs completed healthy.
- BathOS and Inbox Manager are committed, pushed, clean, and synchronized with `origin/main`.

## Remaining Completion Work

1. Prove the authenticated production Safari installation reopens Tasks while the Mac is literally disconnected. Worker version 6, the complete shell, notification permission, and the active push subscription are already accepted.
2. Complete one user-assisted production acceptance pass on the actual iPhone using the exact Home Screen checklist in the Tasks guide.
3. Let the bounded trial reach its 24-hour or 10-task boundary without artificially creating personal work for the test.
4. Confirm the runtime disabled at the intended boundary, no post-boundary credential or network work occurred, the queue is empty, and ordinary Mail and Things outcomes remain healthy.
5. Reconcile the final accepted receipts with the BathOS MCP and PowerSync projection, and record any real retry or failure evidence without exposing task content.
6. Complete Inbox Manager OpenSpec task 6.4, sync its durable specification, archive the change, validate, commit, and push.
7. Sync and archive `enable-tasks-offline-pwa-launch`, then perform one final cross-repository, route, MCP, synchronization, reminder, and health audit before declaring the implementation goal complete.

Four recoverably deleted production-acceptance captures remain as roots in Tasks Trash. Permanent removal still requires explicit action-time confirmation because one setup capture originated from the user's active Safari tab. This cleanup is not a product-readiness blocker.

## Pre-Closeout Validation

The current committed `main` branch passed the following broad gates during the live trial:

- ESLint across the repository
- A production Vite build
- Strict validation of all seven durable OpenSpec specifications
- The full default Vitest suite with 687 passing tests across 117 files and nine intentional opt-in cases skipped
- The opt-in large-library performance suite with four passing tests

The performance gate derived every 10,000-record planning view below 1.4 ms at p95, built the reusable search index below 6.7 ms at p95, rendered a 1,000-row view in 904.5 ms, and opened 10,000-record search in 357.9 ms. The remaining opt-in integration suites already have stronger dated local or production acceptance evidence for offline persistence, multi-client convergence, preservation, sustained parallel use, and production topology. They are not substitutes for the still-running lived Mail handoff trial.

## Offline PWA Shell Acceptance

The active `enable-tasks-offline-pwa-launch` change registers the existing root-scoped Tasks service worker from the authenticated Tasks runtime without requesting notification permission. It stages one atomic, content-free application-shell cache containing rewritten HTML and the recursively discovered same-origin Vite module, worker, and WASM graph. Only same-origin Tasks navigations and the reserved `/tasks-offline-assets/*` namespace are intercepted. API traffic, task data, credentials, provider traffic, ordinary `/assets/*` requests, non-GET requests, cross-origin traffic, and other BathOS modules remain outside the cache path.

A 2026 Jul 21 local production-build pass used a disposable local Supabase account and real Chromium service-worker, Cache Storage, worker, WASM, and OPFS behavior. It proved online staging of 25 public assets plus the shell document, cold offline Today launch, offline creation of one disposable task, offline restart with the mutation retained, and reconnection with the mutation still present. Notification permission remained `default`. The browser pass exposed and drove correction of four defects that simulation alone did not reveal: metadata-prefix self-deletion, encoded-slash asset rejection, `Vary: Origin` module mismatch, and incomplete dynamic module/worker/WASM staging.

Commit `c236b99` was pushed to `main` and published through Lovable deployment `891c310c-2a40-4bc6-8dbc-b6138bca122a`. Production serves Tasks worker version 6. On 2026 Jul 21, the authenticated Safari installation refreshed cleanly and returned to `Synced`. A read-only Web Inspector probe confirmed that `/tasks-service-worker.js` was activated and controlling the page at version 6, the active atomic shell held its HTML document and 25 offline assets, notification permission remained `granted`, and the Web Push subscription remained present. The actual disconnected Safari relaunch remains pending because completing it requires temporarily changing the Mac's network state.

An isolated production browser then registered the deployed worker without signing in or enabling notifications. Production staged 25 public assets plus the shell document, retained notification permission as `default`, and cold-launched `/tasks/today` offline into the ordinary signed-out BathOS surface. This confirms the published hosting and CDN artifact. It does not replace the pending authenticated Safari and installed-iPhone acceptance gates.

## Connector Discovery Note

The BathOS connector catalog attached to this long-running Codex task still exposes the older Budget, Garage, Snake, and Wardrobe tool set. A direct authenticated production `tools/list` request through the existing Raycast OAuth grant confirms that the deployed service includes the complete Tasks tool set. The discrepancy is therefore client-session discovery staleness, not a missing production deployment. A fresh Codex task or connector refresh should discover the current catalog.

## Completion Estimate

No additional large implementation tranche is evident from the durable specifications, archived OpenSpec changes, production evaluations, or source audit. Assuming the bounded trial and offline-shell publication remain healthy, the earliest honest completion point is shortly after 2026 Jul 22 1:50 PM PDT. Production publication, Safari and iPhone acceptance, final evidence reconciliation, specification closeout, validation, and publication should require approximately two to four focused hours after the trial boundary.

## Specification Impact

The active `enable-tasks-offline-pwa-launch` OpenSpec change modifies the personal Tasks offline-operation and layered-reminder requirements. It will be synced into the durable specification only after production acceptance.

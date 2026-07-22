# Tasks Goal Readiness Audit

**Date:** 2026 Jul 21
**Category:** Product / Production / Trust
**Status:** Complete

## Outcome

BathOS Tasks satisfies the implemented V1 contract across the web application, offline synchronization, production PowerSync, MCP, Raycast capture, Mail capture, Web Push reminders, recovery, accessibility, and large-library behavior. The module is available for personal parallel use while Things remains authoritative. A final audit identified that durable task data alone did not guarantee an installed PWA could cold-launch its application shell without a network connection. That offline-launch gap is implemented, published, and accepted through local, isolated production, authenticated Safari, authenticated Chrome, and actual iPhone Home Screen passes under the `enable-tasks-offline-pwa-launch` change. The first iPhone cold launch failed with Safari's no-network page; the corrected installation subsequently passed partition-local readiness, Airplane Mode cold launch, offline restart, queued mutation reconnection, cross-device projection, Web Push delivery, and notification opening.

Production acceptance of the offline PWA shell is complete. The user accepted seven corrected-window Inbox Manager handoffs as sufficient lived proof rather than requiring artificial personal work or waiting for the original ten-task or 24-hour boundary. The runtime was explicitly disabled, the final receipts were reconciled through Supabase and a fresh PowerSync projection, the disabled scheduled path preserved ordinary Mail health, and the Inbox Manager OpenSpec change was synchronized, archived, validated, committed, and pushed.

## Accepted Product Surfaces

- The dark, mobile-first Tasks module provides Inbox, Today, Upcoming, Anytime, Someday, Logbook, Trash, areas, projects, headings, checklist items, templates, recurrence, reminders, search, bulk planning, undo, export, restore, and recoverable history without tags.
- One stable `/tasks/*` runtime preserves synchronization, notification state, local history, and pending work across supported route changes while invalid Tasks routes render the ordinary 404 boundary.
- PowerSync Cloud uses the exact approved 22-table owner-scoped projection. Production topology, restart, conflict, owner-isolation, cleanup, and cross-client convergence gates passed.
- Safari Web Push subscription, provider acceptance, notification opening, acknowledgement, expired-target revocation, and scheduled reminder dispatch passed in production.
- Raycast supports ordinary Inbox capture, current-browser-page capture, Finder-item capture, and AI-refined reading capture through OAuth and the production MCP function. Unreliable selected-text capture was removed from the product contract.
- Inbox Manager creates Things tasks first and conditionally mirrors only accepted new creations into BathOS Tasks during the private bounded trial. Existing tasks, edits, completions, and Mail rules remain outside that handoff.
- Native Apple surfaces and migration from Things remain deliberate future decisions rather than incomplete V1 obligations.

## Durable Requirement Audit

| Requirement | Authoritative Evidence | Status |
| --- | --- | --- |
| Private-First Task Module | Production owner-isolation, RLS, and cleanup gates in `2026-07-20_tasks_production_sync_readiness.md` and `2026-07-21_tasks_production_topology_hardening.md` | Accepted |
| Production Task Synchronization | Exact 22-table production topology, restart, convergence, and current synchronized clients | Accepted |
| Core Task Organization | Archived `add-personal-tasks-module` implementation evidence and `2026-07-20_tasks_live_browser_validation.md` | Accepted |
| Date-Based Planning Views | Browser validation of Inbox, Today, Upcoming, Anytime, Someday, and Logbook with owner-local planning dates | Accepted |
| Tagless Structured Semantics | Typed source, actionability, hierarchy, destination, lifecycle, and product-identity evidence without tags | Accepted |
| Bulk Task Planning | Atomic selection and movement coverage in the archived module change and browser validation | Accepted |
| Native Templates | Template definition, revision, instantiation, MCP, and synchronized-projection coverage in the archived module change | Accepted |
| Orthogonal Task State | Independent planning, lifecycle, disposition, and actionability coverage in domain, repository, and rendered tests | Accepted |
| Temporal Planning Semantics | Start-date, deadline, Today-section, planning-time-zone, and daylight-saving coverage in the archived module change | Accepted |
| Recurrence Integrity | `2026-07-20_tasks_offline_workflow_validation.md`, preservation recovery, and recurrence database/MCP tests | Accepted |
| Stable Manual Ordering | `2026-07-20_tasks_multi_client_convergence.md` and deterministic fractional-order tests | Accepted |
| Offline Task Operation | Offline workflow acceptance plus archived `enable-tasks-offline-pwa-launch` production and iPhone evidence | Accepted |
| Deterministic Task Reconciliation | Multi-client winner-order, stale-revision, conflict-receipt, and reconnection gates | Accepted |
| Actionable Synchronization Diagnostics | `2026-07-21_tasks_sync_reliability.md`, the archived transient-event confirmation change, and current Safari, Chrome, and iPhone diagnostics | Accepted |
| Recoverable History | `2026-07-20_tasks_preservation_recovery.md`, undo, Trash, export, merge, replace, and rollback gates | Accepted |
| Layered Reminder Delivery | `2026-07-20_tasks_reminder_delivery_readiness.md` plus Safari and iPhone Web Push delivery/open acceptance | Accepted |
| Evidence-Gated Native Apple Expansion | `2026-07-20_tasks_native_apple_companion.md`; lived evidence supports continued web/PWA/Raycast use without premature native scope | Accepted by deliberate deferral |
| Keyboard-First Daily Operation | `2026-07-20_tasks_accessibility_validation.md`, browser keyboard passes, and focused component tests | Accepted |
| Deterministic Mail Capture Retry | Archived `fix-tasks-mail-capture-retry` exact-replay, one-task/source/history, and fresh PowerSync-client proof | Accepted |
| Large-Library Responsiveness | `2026-07-20_tasks_large_library_performance.md` and opt-in performance suite | Accepted |
| Parallel Use with Things | Accepted seven-task corrected-window trial, exact nine-receipt backend and projection reconciliation, explicit disable, and healthy post-disable Mail run | Accepted |
| BathOS Product Expression | `2026-07-20_tasks_product_identity.md`, Lucide icon, dark-only BathOS styling, and tagless Tasks naming | Accepted |
| Stable Tasks Route Runtime | `2026-07-21_tasks_route_runtime_stability.md` and route-runtime regression suite | Accepted |
| Module Isolation | Tasks-only source, routes, tables, service-worker interception, MCP namespace, and removal-boundary coverage | Accepted |

## Current Production Evidence

- The production MCP service advertises 42 tools, including 33 Tasks operations covering bounded reads, structured creation, updates, movement, ordering, lifecycle transitions, templates, recurrence, reminders, and Mail retirement.
- A read-only production MCP query for Today on 2026 Jul 21 returned five current to-dos, including four Mail-automation tasks, with no truncation or service error.
- The installed Inbox Manager runtime is healthy and parallel mode is disabled. Seven tasks were accepted during the corrected activation window, the handoff queue is empty, and no handoff failure is recorded. The latest accepted handoff completed at 2026 Jul 21 5:19 PM PDT.
- A 2026 Jul 21 5:55 PM PDT content-free reconciliation covered all nine retained acceptance receipts, including the canary and eight parallel receipts. Supabase contained exactly nine corresponding task rows, nine structured Mail-source rows, and nine creation-history rows. A fresh disposable PowerSync client independently projected exactly the same nine tasks and nine creation-history rows with matching identifiers, revisions, lifecycles, and dispositions. Mail-source rows remained absent from the client as required by the approved server-only projection boundary. The disposable local database was cleared and removed after the pass.
- The explicit disable completed at 2026 Jul 21 6:07 PM PDT with reason `manual`, zero pending requests, all bounded receipts retained, and the outbox hash unchanged at `c5160a90963badab44be8fb018f9981dadd17a954119a573635ee3a222baed69`.
- Ordinary post-disable run `20260722T010819Z-19537` recorded `parallel_disabled` before Mail actions and `empty_outbox` after reconciliation, ended successfully at 2026 Jul 21 6:08 PM PDT, and left the outbox hash unchanged. Mail health remained healthy with no handoff failure or retry state.
- The Mail workflow recovered from one stale enrichment-incident record without changing Mail rules, private mode, accepted task receipts, or scheduled success semantics. Two subsequent ordinary scheduled runs completed healthy.
- BathOS and Inbox Manager are committed, pushed, clean, and synchronized with `origin/main`.

## Completion Closeout

1. The user accepted seven corrected-window tasks as sufficient proof without manufacturing additional personal work.
2. Parallel mode was disabled explicitly before credential or network work, the queue remained empty, and the post-disable scheduled Mail run stayed healthy.
3. All nine retained receipts reconciled exactly against task, structured Mail-source, and creation-history rows, with the approved task and history subset independently reproduced through a fresh PowerSync client.
4. Inbox Manager OpenSpec task 6.4 is complete. The durable specifications were synchronized, the change was archived, all validation passed, and commit `c2f9d36` was pushed to `origin/main`.
5. The final cross-system audit found no remaining V1 implementation or production-readiness gate.

Four recoverably deleted production-acceptance captures remain as roots in Tasks Trash. Permanent removal still requires explicit action-time confirmation because one setup capture originated from the user's active Safari tab. This cleanup is not a product-readiness blocker.

## Pre-Closeout Validation

The current committed `main` branch passed the following broad gates during the live trial:

- ESLint across the repository
- A production Vite build
- Strict validation of all seven durable OpenSpec specifications
- The full default Vitest suite with 708 passing tests across 118 files and nine intentional opt-in cases skipped
- The opt-in large-library performance suite with four passing tests

The 2026 Jul 21 5:57 PM PDT pre-closeout rerun also passed the current Inbox Manager suite with 233 tests, all 181 Mail-rule validation cases, and strict validation of its seven durable specifications plus the then-active parallel-handoff change. BathOS ESLint, production build, 708-test default suite, and all seven durable specifications passed from the synchronized `main` branch in the same audit. After closeout, Inbox Manager again passed all 233 tests, all 181 Mail-rule cases, shell syntax checks, Git whitespace checks, and strict validation of the seven durable specifications with no active OpenSpec change.

The performance gate derived every 10,000-record planning view below 1.4 ms at p95, built the reusable search index below 6.7 ms at p95, rendered a 1,000-row view in 904.5 ms, and opened 10,000-record search in 357.9 ms. The remaining opt-in integration suites have stronger dated local or production acceptance evidence for offline persistence, multi-client convergence, preservation, sustained parallel use, and production topology.

## Offline PWA Shell Acceptance

The archived `enable-tasks-offline-pwa-launch` change registers the existing root-scoped Tasks service worker from the authenticated Tasks runtime without requesting notification permission. It stages one atomic, content-free application-shell cache containing rewritten HTML and the recursively discovered same-origin Vite module, worker, and WASM graph. Only same-origin Tasks navigations and the reserved `/tasks-offline-assets/*` namespace are intercepted. API traffic, task data, credentials, provider traffic, ordinary `/assets/*` requests, non-GET requests, cross-origin traffic, and other BathOS modules remain outside the cache path.

A 2026 Jul 21 local production-build pass used a disposable local Supabase account and real Chromium service-worker, Cache Storage, worker, WASM, and OPFS behavior. It proved online staging of 25 public assets plus the shell document, cold offline Today launch, offline creation of one disposable task, offline restart with the mutation retained, and reconnection with the mutation still present. Notification permission remained `default`. The browser pass exposed and drove correction of four defects that simulation alone did not reveal: metadata-prefix self-deletion, encoded-slash asset rejection, `Vary: Origin` module mismatch, and incomplete dynamic module/worker/WASM staging.

Commit `c236b99` was pushed to `main` and published through Lovable deployment `891c310c-2a40-4bc6-8dbc-b6138bca122a`. Production serves Tasks worker version 6. On 2026 Jul 21, the authenticated Safari installation refreshed cleanly and returned to `Synced`. A read-only Web Inspector probe confirmed that `/tasks-service-worker.js` was activated and controlling the page at version 6, the active atomic shell held its HTML document and 25 offline assets, notification permission remained `granted`, and the Web Push subscription remained present. A Mac-wide disconnected Safari relaunch was deliberately skipped because it would interrupt the Codex host; the later actual iPhone Home Screen Airplane Mode pass provides the authoritative full-transport device acceptance.

An isolated production browser then registered the deployed worker without signing in or enabling notifications. Production staged 25 public assets plus the shell document, retained notification permission as `default`, and cold-launched `/tasks/today` offline into the ordinary signed-out BathOS surface. This confirms the published hosting and CDN artifact.

On 2026 Jul 21, authenticated production Chrome cold-reloaded `/tasks/today` under DevTools Offline emulation. The navigation loaded from `/tasks-offline-assets/`, reopened the local database, rendered all seven then-current Today tasks, preserved the Waiting state, and degraded the due-reminder check without changing schedules. Failed Supabase fetches proved that the page's remote network boundary was active. The pass also revealed that the shared administrator-role hook retried `getUser()` every 250 milliseconds while offline and that Chrome DevTools did not isolate the PowerSync shared-worker transport, allowing its stale or still-live status to leave the header labeled `Synced`.

Commit `d46185e` replaced the fixed retry with offline-event suppression and exponential online backoff capped at 30 seconds, and made the browser offline signal override stale PowerSync status when the browser exposes that signal. The full 703-test suite, lint, production build, and strict OpenSpec validation passed. Lovable then published production entry bundle `index-fNMgIDlc.js`. A repeated authenticated Chrome offline cold reload preserved all eight current Today tasks and the Waiting state. Seven expected startup reads failed together, followed by one retry approximately 7.5 seconds later and one approximately 30 seconds later; the prior 250-millisecond loop did not recur. Chrome continued to show `Synced` because its DevTools profile blocked page fetches without isolating the PowerSync shared worker, so the actual iPhone Airplane Mode pass remains the authoritative full-transport and `Offline`-label gate. After Chrome returned to `No throttling` and reloaded, Tasks restored the signed-in identity and `Synced` state, cleared the degraded reminder-check message, preserved all eight Today tasks and the Waiting state, and produced no new warnings or errors during a 12-second quiet interval.

The first actual iPhone Home Screen pass then failed immediately after Airplane Mode with Safari's standard no-network page. Apple documents that standalone Home Screen web apps keep cookies and storage separate from Safari, so the successful Safari cache inspection did not prove readiness in the installed app's partition. The acceptance instructions also asked only for one online Home Screen launch and exposed no way to know whether that app's worker had activated and completed staging before iOS suspended it. The corrective implementation retains the permanent same-origin `/tasks/manifest.json`, waits up to 30 seconds for the registered worker and atomic shell cache, and reports the current partition as `Offline Launch: Preparing`, `Ready`, `Failed`, or `Unavailable` inside Synchronization Details.

The first corrective deployment published the new HTML and application bundle, but the unversioned worker URL still returned version 6 from a Cloudflare edge with `Cache-Control: max-age=14400`, `Age: 3934`, and `CF-Cache-Status: HIT`. The versioned request `/tasks-service-worker.js?version=7` returned the new deployment and worker version 7 immediately. Registration now advances that query version with each worker release while preserving the existing root scope and push registration. Focused partition, delayed-staging, registration, and Web Push tests, lint, production build, and strict OpenSpec validation pass locally.

Commits `8d241a1` and `2112990` were pushed to `main` and published through Lovable. Production serves entry bundle `index-pIZaUz4l.js`, Tasks chunk `TasksIndex-SnyCkN8G.js`, the permanent `/tasks/manifest.json`, and worker version 7. The live Tasks chunk contains both `tasks-service-worker.js?version=7` and the `Offline Launch` diagnostic. An authenticated existing Safari installation upgraded from `Preparing` to `Ready` within the 30-second bounded stage while remaining `Synced`, healthy, fully synchronized, and at zero pending changes. An authenticated Chrome installation independently reported `Connected`, `Offline Launch: Ready`, healthy, full synchronization complete, zero pending changes, idle upload/download, eight preserved Today tasks, and no console warnings or errors.

The repeated actual iPhone pass then reported `Offline Launch: Ready` in the newly installed Home Screen app, cold-launched Today under Airplane Mode, accepted a disposable `Yes!` task, preserved it across a full offline app restart, uploaded it after reconnection, and projected it to the authenticated Mac client. The Mac remained `Synced` with no console warnings or errors and moved the disposable task recoverably to Trash, returning Today from nine tasks to eight. The final user-assisted production pass delivered a scheduled browser reminder to the iPhone installation and opened Tasks when the notification was tapped. All iPhone device sub-gates passed.

## Transient Synchronization Event Acceptance

Production browser auditing found that ordinary online reconnect cycles could briefly surface `Offline` or `Download Error` and immediately recover with zero pending work. Persisting those state transitions made Recent Reliability Events noisy even though the live status recovered normally.

The first corrective candidate used a five-second confirmation interval. Focused tests and all release gates passed, but the published `d797f7a` build still recorded three zero-queue Offline events during a normal production reload. Bundle inspection confirmed that production was running the candidate rather than a stale artifact.

Commit `751a974` increased confirmation to 30 seconds while preserving immediate live status, first-observed episode timing, immediate recovery reconciliation, reload continuity, and the existing two-minute reporting boundary. Five focused observer tests, the full 708-test default suite with nine intentional skips, ESLint, the production build, and strict OpenSpec validation passed. Lovable published production entry bundle `index-Dl3YByCl.js`.

The production acceptance captured the existing Recent Reliability Events value, reloaded authenticated `/tasks/today` online, and waited 45 seconds. The event history remained byte-for-byte unchanged. Synchronization Details reported Connected, Offline Launch Ready, Healthy, Full Synchronization Complete, zero pending changes, and idle upload and download state. The console contained no warnings or errors. Transient reconnect signals therefore remain visible live, while only sustained degradation becomes durable reliability history.

## Connector Discovery Note

The BathOS connector catalog attached to this long-running Codex task still exposes the older Budget, Garage, Snake, and Wardrobe tool set. A direct authenticated production `tools/list` request through the existing Raycast OAuth grant confirms that the deployed service includes the complete Tasks tool set. The discrepancy is therefore client-session discovery staleness, not a missing production deployment. A fresh Codex task or connector refresh should discover the current catalog.

## Completion Status

The implemented BathOS Tasks V1 goal is complete. No additional implementation tranche is required by the durable specifications, archived OpenSpec changes, production evaluations, or source audit. Things remains authoritative while Tasks is available for personal parallel use. Native Apple surfaces, Things migration, and any later product expansion remain deliberate future work rather than incomplete V1 obligations.

## Specification Impact

The archived `enable-tasks-offline-pwa-launch` OpenSpec change modified the personal Tasks offline-operation and layered-reminder requirements. Production acceptance passed and its delta is synchronized into the durable specification. The Inbox Manager parallel-handoff contracts are synchronized and archived in the sibling repository. This readiness closeout is documentation-only and has no further BathOS specification impact.

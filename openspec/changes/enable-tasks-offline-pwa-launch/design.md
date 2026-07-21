## Context

PowerSync already retains Tasks rows and queued mutations in durable browser storage, and integration gates prove those records survive database restart. The production Tasks service worker currently handles only Web Push and notification routing. It is registered inside the explicit reminder-enable action, has root scope so notification clicks can find any open BathOS window, and has no fetch handler or application-shell cache.

An installed PWA therefore works offline only while its already loaded JavaScript remains alive or while the browser happens to retain every required response in ordinary HTTP cache. iOS can evict a Home Screen web app between launches, so this is not a reliable offline-restart contract.

The correction must preserve one root-scoped registration and the existing push subscription. It must not cache Supabase, PowerSync, MCP, authentication, or unrelated BathOS module traffic.

## Goals / Non-Goals

**Goals:**

- Reopen a previously loaded `/tasks/*` PWA route during temporary network loss.
- Load the current Tasks application shell and versioned Vite assets from an explicit service-worker cache.
- Register the service worker without requesting notification permission or creating a push subscription.
- Refresh the offline shell after an online navigation without exposing a partially updated shell.
- Preserve Web Push delivery, notification clicks, sign-out cleanup, and immediate backward-compatible worker activation.
- Leave every non-Tasks navigation, API request, and nonversioned resource outside fetch interception.

**Non-Goals:**

- Do not make a never-before-loaded installation work offline.
- Do not cache task content, Supabase responses, PowerSync traffic, OAuth state, or credentials in Cache Storage.
- Do not provide offline template capture, recurrence definition, reminder mutation, authentication, or other server-owned operations.
- Do not add a second service worker, a new dependency, or a native Apple target.
- Do not change the offline task mutation and reconciliation rules already implemented by PowerSync.

## Decisions

### Keep one combined Tasks and reminder worker

Register `/tasks-service-worker.js` idempotently when the authenticated Tasks runtime starts on a secure supported client. The reminder-enable action reuses that registration before creating a push subscription. Registration alone does not call `Notification.requestPermission`, `PushManager.subscribe`, or the server.

Using one worker preserves the existing root-scoped push subscription and avoids competing registrations. A second worker with overlapping scope would let the newest registration replace the other behavior and make notification delivery or offline launch order-dependent.

### Use network-first Tasks navigation with an atomic versioned shell cache

For same-origin GET navigation requests whose pathname is `/tasks` or starts with `/tasks/`, request the network first. When the response is successful HTML, derive its same-origin versioned `/assets/` references, fetch every required asset, and populate a staging cache named from a digest of the HTML. Update a small content-free cache pointer only after the complete staging cache succeeds, then remove superseded Tasks shell caches.

If navigation fails, resolve the active pointer and return its cached shell HTML. A failed refresh leaves the previous active shell untouched. This gives online users current deployment behavior and prevents HTML from pointing to a partially cached asset set.

Alternative considered: Use one fixed cache and replace entries in place. Rejected because a failed asset request could leave offline HTML and JavaScript from different deployments.

Alternative considered: Inject a build manifest into a generated worker. Rejected for this slice because network-first navigation already observes the current HTML, Vite asset URLs are content-addressed, and runtime staging avoids a new build plugin while preserving atomicity.

### Intercept only versioned application assets and Tasks documents

While staging, rewrite only the cached offline HTML's same-origin versioned `/assets/` references into a reserved `/tasks-offline-assets/` namespace and store the fetched public assets under those namespaced request keys. Handle that namespace only when serving the offline shell. Normal online HTML continues using ordinary `/assets/` URLs, which the worker does not intercept.

Do not intercept Supabase, PowerSync, Edge Function, MCP, OAuth, authentication, root document, manifest, image, ordinary `/assets/`, or unrelated module requests. Non-Tasks navigations receive no `respondWith` call.

This boundary keeps cached content limited to public application code and CSS. Task data remains exclusively in the existing PowerSync database.

### Precache only after a successful first online Tasks load

The worker install event fetches `/tasks/today`, stages its complete shell, and requests immediate activation. Registration is initiated after the Tasks runtime renders, so the current online page remains usable if installation cannot complete. A later online navigation or registration retry can establish the cache.

The activate event claims clients and removes abandoned Tasks staging caches while retaining the active cache named by the pointer. Existing push subscriptions remain attached to the unchanged service-worker registration.

### Keep offline readiness silent and testable

Do not add a new banner or claim offline readiness before the worker and cache are actually available. The final iPhone acceptance will verify installation, standalone launch, offline restart, local mutation, reconnection, and Web Push explicitly. Automated tests cover registration isolation and service-worker cache behavior without asserting browser-specific storage guarantees that only the device can prove.

## Risks / Trade-offs

- [Risk] A deployment refresh fails while fetching one new asset -> Mitigation: Keep the prior pointer and cache active until the complete new shell is staged.
- [Risk] A root-scoped fetch handler affects another BathOS module -> Mitigation: Call `respondWith` only for Tasks navigation and the reserved `/tasks-offline-assets/` namespace present exclusively in cached offline Tasks HTML, and test ordinary assets, unrelated navigation, and API pass-through.
- [Risk] Cached code outlives a breaking server contract -> Mitigation: Prefer network navigation, use content-addressed assets, refresh atomically whenever online, and keep durable Tasks server contracts backward compatible.
- [Risk] Cache Storage grows across interrupted staging attempts -> Mitigation: Delete failed staging caches immediately and remove every nonactive Tasks shell cache during successful refresh and activation.
- [Trade-off] First installation requires a complete online shell fetch -> This is explicit and preferable to claiming offline readiness from an incomplete cache.

## Migration Plan

1. Add the runtime registration helper and refactor reminder enablement to reuse it.
2. Extend the existing service worker with Tasks-only shell staging, activation cleanup, navigation fallback, and versioned-asset handling.
3. Add focused registration, cache, fetch-isolation, update, push, and notification tests.
4. Run lint, the full suite, production build, strict OpenSpec validation, and a local browser online/offline launch gate.
5. Publish through the normal BathOS deployment path and verify production Safari before the iPhone exercise.
6. On the iPhone, load Tasks online once, add it to the Home Screen, verify standalone offline restart and queued mutation recovery, reconnect, and then enable and test reminders through an explicit user gesture.

Rollback restores the prior worker source and runtime registration behavior. The browser will install that worker as the next script revision. Superseded public code caches contain no task data or credentials and can be deleted by the rollback worker or left for browser eviction.

## Open Questions

None.

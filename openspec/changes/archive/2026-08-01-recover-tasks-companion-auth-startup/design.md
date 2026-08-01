## Context

The BathOS Tasks iOS companion is a single app-bound `WKWebView` that hosts the production Tasks web application. Supabase Auth selects the browser `Navigator LockManager` by default when persistent sessions are enabled. On the affected iPhone, the companion can survive or restart around an interrupted WebKit content process while the browser-wide auth lock remains unavailable. The initial `getSession()` call then rejects after its lock-acquisition timeout.

`AuthProvider` currently handles only the successful `getSession()` branch. A rejected initial session read therefore leaves `loading` true forever, which renders the same central spinner indefinitely even though the network and production origin are healthy.

The repair crosses the shared Supabase client, shared authentication state, and the Tasks companion bridge boundary. It must preserve ordinary Safari and PWA cross-tab session coordination, preserve module isolation, and avoid introducing a second native authentication or data implementation.

## Goals / Non-Goals

**Goals:**

- Let the single-view native Tasks companion serialize Supabase auth work inside its current WebKit process without depending on a browser-wide lock that can remain stale after interruption.
- Preserve Supabase's normal browser lock selection in Safari, installed PWAs, and other ordinary web contexts.
- Guarantee that initial authentication bootstrap reaches a settled state after either success or failure.
- Add deterministic regression coverage for companion detection, lock selection, and rejected session bootstrap.
- Prove the repair with a fresh physical-device launch after the matching web release is published.

**Non-Goals:**

- Reimplement authentication, Tasks data, synchronization, or offline behavior in Swift.
- Change Supabase schema, RLS, secrets, roles, or authentication policy.
- Change native bundle identities, entitlements, signing, or WidgetKit projection behavior.
- Claim that every possible failed network request is recoverable without user action.

## Decisions

### Detect the approved companion through shared platform code

A narrow shared helper will identify the native Tasks companion only when the approved `window.webkit.messageHandlers.bathosTasksWidget.postMessage` bridge is present. The Supabase integration can use this helper without importing from the Tasks module, preserving module isolation. The existing Tasks widget bridge will reuse the same helper and handler lookup rather than maintaining a second environment test.

Alternative considered: infer the companion from user agent, display mode, or route. Those signals are forgeable and overlap Safari or installed PWAs, so they would incorrectly alter ordinary browser locking.

### Use Supabase's process-local serialized lock only in the companion

The Supabase client will receive `processLock` from `@supabase/auth-js` only in the approved companion. `processLock` retains serialization among auth operations in the current JavaScript process while avoiding the cross-document Navigator LockManager boundary that can outlive an interrupted WebKit content process. `@supabase/auth-js` will be declared directly because the application imports its public API directly.

Ordinary web contexts will omit the custom lock option so `@supabase/supabase-js` continues choosing its supported browser default and coordinating persistent sessions across tabs.

Alternative considered: disable locking or provide a no-op lock. That would remove serialization and risk concurrent token refresh or storage mutation inside the companion. Alternative considered: force `processLock` for every BathOS client. That would weaken normal multi-tab coordination in Safari and PWAs.

### Settle authentication bootstrap on every outcome

`AuthProvider` will handle both fulfillment and rejection of the initial `getSession()` promise. A current successful auth event remains authoritative. If the initial read rejects before any authenticated session is observed, the provider will clear the provisional session state and leave loading mode so routing can present the ordinary signed-out experience instead of an indefinite spinner. Cleanup will prevent late promise settlement from mutating an unmounted provider.

The fallback is deliberately bounded and silent in the primary Tasks UI. The companion-specific lock prevents the known failure, while the rejection path guarantees liveness for other auth bootstrap errors.

Alternative considered: retry `getSession()` indefinitely. That would reproduce the permanent loading failure under a persistent error and conceal a real authentication problem.

## Risks / Trade-offs

- **A bridge-shaped object could be injected into an ordinary page** -> Require the exact approved handler contract and treat the switch only as a concurrency choice, never as authorization.
- **Process-local locking does not coordinate multiple WebKit processes** -> The companion owns one persistent app-bound view, while ordinary multi-tab browsers retain the Navigator LockManager.
- **A bootstrap rejection can temporarily present the signed-out route** -> This is recoverable and preferable to an infinite spinner; successful auth events remain capable of restoring the session.
- **A future companion adds multiple simultaneous web views** -> Revisit the lock boundary before adding that architecture; this change explicitly targets the current single-view host.

## Migration Plan

1. Publish the web repair without changing native binaries or Supabase infrastructure.
2. Launch the existing signed companion online from a terminated state and verify that authenticated Today content replaces the spinner within a bounded interval.
3. Repeat the existing offline warm-cache launch acceptance to ensure the lock selection does not regress cached startup.
4. Roll back the web release if ordinary browser authentication or physical companion startup regresses. No database rollback is required.

## Open Questions

None. A future multi-view native host would require a new lock-design decision.

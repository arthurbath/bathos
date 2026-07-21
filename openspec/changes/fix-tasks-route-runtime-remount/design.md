## Context

BathOS currently registers every supported Tasks path as a sibling React Router route whose element contains `TasksIndex`. Moving from `/tasks/today` to `/tasks/inbox` therefore replaces the matched route element. React unmounts `TasksRuntimeProvider`, its cleanup closes the PowerSync database asynchronously, and the replacement provider immediately opens the same shared local database and starts another connection.

A production Safari pass reproduced the resulting trust failure. Today initially reported Synced and healthy reminders. Plain-left-click navigation to Inbox reported Offline, then remained Connecting, and the due-reminder claim surfaced a failure. Returning to Today remained Connecting. A full page reload restored Synced and healthy reminder capability. Source inspection also found that implemented area-detail links target `/tasks/areas/:areaId`, but that route is absent from the route registry and falls through to Not Found.

## Goals / Non-Goals

**Goals:**

- Preserve one authenticated `TasksRuntimeProvider`, PowerSync database, connector, reliability observer, and reminder polling lifecycle across every supported internal Tasks route.
- Keep route-specific rendering, URL changes, focus behavior, real links, browser history, and modified-click behavior intact.
- Register both project and area detail paths and keep unknown Tasks paths outside the Tasks shell.
- Prove component identity and cleanup behavior with a router-level regression test, then verify the published result in production Safari.

**Non-Goals:**

- Change PowerSync, Supabase, reminder RPCs, synchronization state derivation, or local database ownership.
- Keep the Tasks runtime mounted after navigation to another BathOS module, authentication, or an unknown route.
- Add another routing library, persistence layer, retry loop, or workaround for the remount.
- Modify task content or the production database during acceptance.

## Decisions

### Register one wildcard Tasks route with an explicit supported-path guard

`AppRoutes` will retain the `/tasks` redirect and replace the sibling route map with one `/tasks/*` element. `TasksRoute` will use a shared exact matcher for the known static, project-detail, and area-detail paths. Supported path changes therefore reconcile the same element instance. Unknown paths render the existing deferred Not Found behavior rather than falling back to Today.

This is preferable to memoizing the database outside React because the current provider ownership is correct when the user actually leaves Tasks or changes accounts. It is also preferable to adding reconnect delays because that would mask the unnecessary teardown and preserve reminder and reliability-observer churn.

### Keep the route catalogue as the single supported-path source

`TASK_ROUTE_PATHS` remains the declarative list used by tests and adds `/tasks/areas/:areaId`. A matcher derived from that catalogue determines whether the wildcard route renders Tasks. The shell continues deriving its current view and stable detail identifier from `location.pathname`.

This avoids a second list drifting from route registration and fixes the existing area-link contradiction without widening Tasks to arbitrary `/tasks/...` URLs.

### Test provider identity through the real route boundary

A router-level test will mock `TasksIndex` with mount and cleanup counters, navigate among Today, Inbox, a project detail, and an area detail, and prove one mount with no cleanup. It will also navigate to an unknown Tasks path and prove the Tasks subtree unmounts so the not-found boundary remains intact.

Pure route tests alone are insufficient because every prior path was technically registered. The defect is the React lifecycle produced by the registration shape.

## Risks / Trade-offs

- [Risk] A wildcard route could accidentally accept unknown Tasks URLs. → Mitigation: Require an exact match against `TASK_ROUTE_PATHS` before rendering `TasksIndex` and test an unknown path.
- [Risk] Persisting the shell across view changes could preserve view-local state unintentionally. → Mitigation: The shell already resets selection, bulk state, and capture focus from the derived view, and existing view-transition tests remain authoritative.
- [Risk] The production symptom could include a provider-specific connection issue beyond remounting. → Mitigation: Verify provider identity locally and repeat the exact Safari transition after publication. Continue investigation if Synced does not remain stable.
- [Trade-off] The provider still closes and reconnects when leaving Tasks entirely. → This is intentional ownership cleanup and remains outside the defect.

## Migration Plan

1. Add the guarded wildcard route and area-detail pattern with router-level lifecycle tests.
2. Run Tasks typecheck, focused tests, the full suite, lint, build, and strict OpenSpec validation.
3. Commit and push to the production publication branch.
4. Wait for the published bundle, reload Tasks once, then navigate through representative static and detail routes in Safari while verifying Synced status and reminder health.
5. Roll back the routing commit if unknown paths become accepted or supported route rendering regresses. No database or remote-service rollback is required.

## Open Questions

None.

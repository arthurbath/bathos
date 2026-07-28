# Tasks iOS Companion Authentication Startup

## Incident

On July 28, 2026, the installed BathOS Tasks iOS companion remained indefinitely on its single central loading spinner while the iPhone had a working network connection. The same production Today route loaded through an ordinary browser after a bounded authentication delay, isolating the failure to the app-bound WebKit session rather than the route or production origin.

Source inspection found a complete liveness failure:

1. Persistent Supabase Auth chooses the browser `Navigator LockManager` by default.
2. An interrupted app-bound WebKit content process can leave that browser-wide auth lock unavailable to the restarted companion.
3. The initial `supabase.auth.getSession()` call can reject after its lock-acquisition timeout.
4. `AuthProvider` handled only the fulfilled promise, so a rejection left `loading` true forever.

## Repair

The approved native companion is now detected only through its callable `bathosTasksWidget` WebKit message handler. In that single-view environment, Supabase Auth uses its supported process-local serialized lock. Safari, installed PWAs, and ordinary browsers omit the override and retain Supabase's browser lock behavior for cross-tab coordination.

The shared authentication provider now handles both fulfillment and rejection of the initial session read, ignores late settlement after cleanup, and always leaves loading mode after an unauthenticated startup failure. A successful authenticated event that arrives before a late failed read remains authoritative.

This is a web-only repair. It does not change the signed iOS binary, WidgetKit extension, App Group, Supabase schema, RLS, roles, secrets, or task data.

## Local Evidence

- Focused regression suite: 4 files, 16 tests passed.
- Full application suite: 144 files passed, 7 integration or performance files skipped by their explicit opt-in gates, 1,070 tests passed, 14 tests skipped.
- Tasks TypeScript check: passed.
- ESLint: passed.
- Production build: passed.
- Strict OpenSpec validation: 13 specifications and changes passed.
- Local ordinary-browser startup reached the sign-in experience rather than remaining on the loading spinner, confirming that the browser path retains a settled authentication state.

## Production Acceptance

Pending publication of the matching BathOS web release:

- Terminate and relaunch the existing signed companion while online.
- Confirm authenticated Today content replaces the central spinner within a bounded interval.
- Warm the current release, terminate the companion, enable Airplane Mode, and confirm the cached Tasks application still launches.

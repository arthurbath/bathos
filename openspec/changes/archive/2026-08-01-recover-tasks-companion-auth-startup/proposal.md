## Why

The signed BathOS Tasks companion can remain forever on its central loading spinner even while the iPhone is online. App-bound WebKit can leave Supabase's browser-wide Navigator Lock unavailable after process interruption, and the shared authentication bootstrap currently never leaves its loading state when `getSession()` rejects.

## What Changes

- Use a process-local serialized Supabase auth lock only when the approved native Tasks bridge proves the web app is running inside its single-view iOS companion.
- Preserve the ordinary Navigator LockManager behavior for Safari, installed PWAs, and every other browser context.
- Make authentication bootstrap handle session-read failures and always leave the loading state instead of displaying an indefinite spinner.
- Add regression coverage for native-companion detection, lock selection, failed session bootstrap, and successful authenticated startup.
- Record the production incident and physical-device acceptance boundary.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tasks-ios-companion`: Require the app-bound web host to recover authentication without relying on a stale browser-wide lock and prohibit an indefinite startup loading state.

## Impact

- **Shared authentication:** `src/integrations/supabase/client.ts` and `src/platform/contexts/AuthContext.tsx`.
- **Tasks native bridge:** A narrow reusable companion-environment detector and its tests.
- **Native app:** No new native data client, entitlement, App Group, bundle identity, or database behavior.
- **Supabase:** No schema, RLS, secret, Edge Function, or production-role changes.
- **Browsers:** Ordinary web contexts retain Supabase's default cross-tab lock behavior.

## Why

BathOS currently accepts a user-controlled `next` query parameter that can preserve backslash-based external-navigation payloads and passes that value to a vulnerable React Router release. The shared authentication and routing boundary must reject non-local destinations independently of library behavior, and the router must move to a patched supported release.

## What Changes

- Require authentication redirects to resolve to a same-origin BathOS path before navigation or tab switching.
- Reject protocol-relative, backslash-based, encoded, and non-path redirect payloads while preserving valid internal paths, query strings, fragments, and the Lovable OAuth consent route.
- Upgrade `react-router-dom` and its installed router package from 6.30.4 to exact version 7.18.2, the newest React 18-compatible 7.x release.
- Adapt the shared browser-router compatibility boundary to React Router 7 without changing registered platform, module, legacy redirect, or not-found outcomes.
- Record the remaining GHSA-qwww-vcr4-c8h2 audit exception as unreachable because BathOS uses neither React Server Components nor React Router's unstable RSC APIs.
- Add focused security regressions and run the complete repository validation gate.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform-routing-compatibility`: Add the same-origin authentication redirect contract and update the shared router compatibility requirement for the patched installed router.

## Impact

- Shared platform routing and authentication components under `src/platform/`
- Shared application routing in `src/App.tsx`
- Authentication, routing, launcher, module-access, and scroll-restoration tests
- Direct `react-router-dom` dependency and npm lockfile
- Every BathOS browser route through the shared router boundary
- No module data behavior, Supabase object, Edge Function, database migration, native companion, or public API change

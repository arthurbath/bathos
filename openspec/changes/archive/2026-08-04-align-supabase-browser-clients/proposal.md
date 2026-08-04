## Why

BathOS's browser Supabase clients are pinned to 2.95.3 and therefore lack the current client's automatic transient retry behavior. Upgrading without reconciling BathOS's existing generic retry wrappers would multiply request attempts and continue retrying non-idempotent writes more broadly than the Supabase client's safe GET/HEAD policy.

## What Changes

- Pin `@supabase/supabase-js` and direct `@supabase/auth-js` to exact matching stable version 2.112.0.
- Make the Supabase client's bounded GET/HEAD transient retry behavior the single generic database retry layer.
- Stop generic BathOS wrappers and React Query from multiplying Supabase retry attempts or automatically replaying non-idempotent writes.
- Preserve the native-companion `processLock`, ordinary browser session coordination, and all authentication behavior.
- Keep every Edge Function import unchanged for the separately gated Edge dependency phase.

## Capabilities

### New Capabilities

- `browser-supabase-reliability`: Exact browser-client alignment, bounded transient-read recovery, mutation replay safety, and native-companion auth-lock preservation.

### Modified Capabilities

None.

## Impact

- Dependencies: `@supabase/supabase-js`, `@supabase/auth-js`, their aligned transitive Supabase packages, and `package-lock.json`.
- Shared runtime: `src/integrations/supabase/client.ts`, `src/lib/supabaseRequest.ts`, and the root React Query configuration.
- Verification: authentication, account, household, module data hooks/repositories, local Supabase sessions, Tasks integration suites, Safari authenticated module smoke tests, clean install, build, audit, and performance evidence.
- No database schema, RLS, production data, Edge Function source, or deployment change.

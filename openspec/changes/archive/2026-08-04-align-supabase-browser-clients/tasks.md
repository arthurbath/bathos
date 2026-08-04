## 1. Compatibility and Retry Boundaries

- [x] 1.1 Record the current stable Supabase 2.x release, Node and TypeScript requirements, relevant changelog changes, pre-upgrade graph, and focused regression map.
  - Evidence: `docs/agents/evaluations/2026-08-04_supabase-browser-client-alignment.md` records the exact 2.95.3 to 2.112.0 graph, Node 22+ and TypeScript support boundaries, official transient-read retry behavior, current retry multiplication, focused tests, and rollback.
- [x] 1.2 Add failing tests for exact client options, native `processLock` preservation, single-layer query retry behavior, and generic mutation non-replay.
  - Evidence: the focused pre-change run failed because the shared client lacked explicit database retry configuration, `supabaseRequest` replayed both resolved and thrown transient failures four times, and no single-layer QueryClient policy existed. The existing `authLock` tests continued to prove ordinary-browser and native-companion selection.

## 2. Browser Client Alignment

- [x] 2.1 Pin direct `@supabase/supabase-js` and `@supabase/auth-js` to exact 2.112.0 and verify all Supabase JavaScript subpackages align without invalid or duplicate direct Auth nodes.
  - Evidence: `npm ls` reports direct supabase-js and Auth 2.112.0 with deduplicated Auth and exact 2.112.0 PostgREST, Realtime, Storage, and Functions clients. The direct supabase-js range is now exact, and the graph has no invalid nodes or peer conflicts.
- [x] 2.2 Enable the Supabase client's bounded read retries and remove generic outer retries from `supabaseRequest` and the root React Query policy while retaining explicit domain-safe retry paths.
  - Evidence: the shared client explicitly sets `db.retry: true` and pins its schema generic to `public`; `supabaseRequest` now performs exactly one operation and normalizes its result; the root QueryClient sets `retry: false`. Existing explicit Tasks revision/mutation and Drawers retry mechanisms remain unchanged for their separately owned behavior.
- [x] 2.3 Inspect manifest, lockfile, installed graph, browser bundle, and generated Edge output, restoring any out-of-scope Edge source changes.
  - Evidence: the production build passed with 3,496 modules, unchanged CSS and Tasks chunk sizes, and a main client chunk of 1,481.08 kB (422.14 kB gzip). Build generation changed the MCP Lovable pins and Supabase import as expected; all three Edge-source changes were inspected and restored for Phase 5.

## 3. Focused Supabase Verification

- [x] 3.1 Run retry-policy, auth lock, AuthContext, AuthPage, account, household, password/reset, sign-out, and representative module data-hook/repository tests.
  - Evidence: 16 focused files passed all 108 tests, covering shared client options, retry ownership, Auth lock selection, AuthContext, AuthPage, AccountPage, household management, Tasks sign-out/repository behavior, and representative Budget, Garage, Snake, and Wardrobe data surfaces.
- [x] 3.2 Prove local Supabase session creation, token refresh/restoration, ordinary sign-out, and native-companion lock selection without production mutation.
  - Evidence: the new opt-in local lifecycle integration created a synthetic local account, refreshed its token, restored the persisted session through a second browser-like client, signed out, and independently read back no remaining session or synthetic user. Existing `authLock` tests prove `processLock` is selected only for recognized native companions. No production endpoint or data was used.

## 4. Complete Acceptance

- [x] 4.1 Prove a clean install and valid dependency graph, then run the fresh audit, complete repository gate, applicable Tasks integration matrix, advisory performance checks, Safari authenticated coverage across all modules, strict OpenSpec validation, and Git diff checks.
  - Evidence: a fresh `npm ci` and `npm ls --all` passed, and the temporary install tree was removed. The audit remains at 0 critical, 2 high, 3 moderate, and 1 low classified finding. The repository gate passed 173 files and 1,429 tests, lint, Tasks typecheck, production build, and 52 strict OpenSpec validations. The local browser lifecycle, offline persistence, multi-client convergence, preservation/recovery, and default ten-minute sustained integrations passed. The sustained run completed 300 cycles, 300 tasks, 1,050 history rows, 150 offline conflicts, 150 stale MCP conflicts, 600 idempotent retries, and 12 restarts. Safari authenticated a disposable local account and rendered all six modules. Upcoming-view p95 was 63.27 ms, while the 1,000-row render took 2,781.58 ms against the waived 2,000 ms ceiling. Generated Edge changes were restored, and cleanup readback found zero synthetic users, task/history rows, harness containers/volumes, publication, slots, temporary install tree, or development server.

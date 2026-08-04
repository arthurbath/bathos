# Supabase Browser Client Alignment Evaluation

## Scope

This evaluation selects and bounds the Phase 4 browser-client upgrade. It does not change Supabase schema, RLS, Auth providers, production data, Edge Function sources, or deployed functions.

## Current and Target Graph

| Package | Current | Target |
| --- | ---: | ---: |
| `@supabase/supabase-js` | 2.95.3 exact | 2.112.0 exact |
| Direct `@supabase/auth-js` | 2.95.3 exact | 2.112.0 exact |
| supabase-js-owned Auth/PostgREST/Realtime/Storage/Functions clients | 2.95.3 | 2.112.0 |

Registry metadata checked on 2026-08-04 identifies 2.112.0 as the stable `latest` release for both direct packages. Supabase JS 2.112.0 declares exact 2.112.0 dependencies for its Auth, PostgREST, Realtime, Storage, and Functions clients. It requires Node 22 or later. BathOS uses Node 24.12.0 and TypeScript 5.8.3.

## Relevant Supabase Changes

- [Automatic PostgREST retries for transient errors](https://supabase.com/changelog/45071-automatic-postgrest-retries-for-transient-errors) began in Supabase JS 2.102.0. GET and HEAD requests retry network, HTTP 503, and HTTP 520 failures up to three times after the initial attempt, with 1, 2, and 4 second exponential delays. Writes are not retried.
- [Node 20 support ended](https://supabase.com/changelog/45715-deprecation-notice-dropping-support-for-node-js-20) on 2026-06-30. BathOS's Node 24 runtime is supported.
- The announced TypeScript 5 minimum begins in 2027. BathOS already uses TypeScript 5.8.3.
- The 2026 self-hosted gateway and platform changes do not alter this browser-only package update or the existing local Supabase test topology.

## Existing Retry Interaction

Before the upgrade, BathOS can retry one logical database query in three places:

1. `supabaseRequest` performs up to four total attempts and does not distinguish safe reads from non-idempotent writes.
2. React Query repeats likely network failures through the root default policy.
3. Supabase JS 2.112.0 adds up to four internal attempts for GET and HEAD.

Retaining every layer would multiply request count and failure latency. Retaining the generic wrapper for writes would also continue replaying mutations after ambiguous responses, contrary to the newer client's method-safe policy.

## Decision

Use Supabase JS's enabled GET/HEAD retry as the single generic database retry layer. Make `supabaseRequest` a one-attempt result/error normalizer and disable root React Query automatic retries. Preserve explicitly designed domain retries where mutation identities, revision guards, or other idempotency controls prevent duplication.

Supabase JS 2.112.0 also widens the inferred schema generic when only the database generic is supplied. The shared client now explicitly uses the `public` schema generic. This retains generated column and RPC type safety instead of suppressing the resulting TypeScript errors with local casts. The installed package names the explicit retry option `db.retry`, so the implementation follows the package's shipped API rather than the earlier changelog terminology.

## Focused Regression Map

| Surface | Verification |
| --- | --- |
| Exact client configuration | Mocked `createClient` option inspection plus `npm ls` |
| Native-companion lock | `src/integrations/supabase/authLock.test.ts` and shared-client option test |
| Generic retry bound | New `supabaseRequest` unit tests and root QueryClient policy test |
| Browser authentication | AuthContext, AuthPage, AccountPage, reset/sign-out tests, local lifecycle exercise, and Safari |
| Household and module data | Household tests plus Budget, Drawers, Garage, Snake, Wardrobe, and Tasks hook/repository tests |
| Offline and synchronization behavior | Tasks offline, multi-client, preservation, and sustained integrations |
| Generated Edge isolation | Git diff inspection after builds and MCP generation |

## Rollback

Restore both exact 2.95.3 package pins, the prior lockfile, the prior generic wrapper retry implementation, and the prior React Query policy as one unit. No database or deployed-function rollback is required.

## Acceptance Evidence

- A fresh temporary-directory `npm ci` installed 732 packages, and `npm ls --all` reported a valid graph. The temporary directory was removed after acceptance.
- The fresh audit reports 0 critical, 2 high, 3 moderate, and 1 low package finding. These are the same classified React Router RSC-only, Lovable MCP Windows-only Hono, and nested Windows-only esbuild findings retained after Phase 3.
- The complete repository gate passed 173 test files and 1,429 tests with 9 files and 16 opt-in tests skipped. Lint, Tasks typecheck, the production build, and all 52 strict OpenSpec validations passed.
- The production build transformed 3,496 modules. The Tasks chunk was 649.34 kB (181.36 kB gzip), and the main client chunk was 1,481.07 kB (422.13 kB gzip). Generated MCP imports were inspected and restored so Phase 4 made no Edge-source change.
- The local browser lifecycle integration created, refreshed, restored, signed out, and deleted a synthetic session through the upgraded client.
- Offline persistence, multi-client convergence, preservation/recovery, and the default ten-minute sustained test passed against local Supabase and the disposable PowerSync service. The sustained run completed 300 cycles, 300 tasks, 1,050 history rows, 150 offline conflicts, 150 stale MCP conflicts, 300 capture retries, 300 transition retries, and 12 client restarts.
- The first offline attempt correctly showed authoritative revision 2 while the local database remained at revision 1 because the disposable PowerSync service was not running. After the documented harness was restored, the same integration passed in 2.1 seconds. Its timeout diagnostic now reports both local and authoritative revisions.
- Safari authenticated a disposable local account and rendered Budget, Drawers, Garage, Snake, Tasks, and Wardrobe. Tasks completed its PowerSync load and reached the empty Today state. The only mirrored browser warning was the pre-existing Garage dialog description warning.
- The isolated advisory performance run kept all task derivation and search checks inside their ceilings. Upcoming-view p95 was 63.27 ms. The 1,000-row rendered view took 2,781.58 ms against the temporary 2,000 ms ceiling, so it remains advisory under the approved upgrade waiver.
- Cleanup readback found zero Phase 4 synthetic users, task rows, history rows, disposable PowerSync containers, volumes, publication, replication slots, temporary install tree, or local development server.
